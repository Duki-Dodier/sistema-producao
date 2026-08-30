"use client";

import { useRef, useState } from "react";
import workerPdfUrl from "pdfjs-dist/legacy/build/pdf.worker.mjs?url";
import type { DadosImportadosLibellula } from "@/lib/libellula-pdf";
import { extrairDadosLibellula } from "@/lib/libellula-pdf";

export function ImportadorPdfLibellula({
  onImportar,
}: {
  onImportar: (dados: DadosImportadosLibellula) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [estado, setEstado] = useState<"idle" | "lendo" | "pronto" | "erro">("idle");
  const [mensagem, setMensagem] = useState("");

  async function importar(arquivo: File) {
    if (arquivo.type !== "application/pdf" && !arquivo.name.toLowerCase().endsWith(".pdf")) {
      setEstado("erro");
      setMensagem("Escolha um arquivo PDF exportado pelo Libellula.");
      return;
    }
    if (arquivo.size > 10 * 1024 * 1024) {
      setEstado("erro");
      setMensagem("O arquivo deve ter até 10 MB.");
      return;
    }

    setEstado("lendo");
    setMensagem("Lendo os dados do relatório…");
    try {
      const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
      // O Vite publica o worker como arquivo separado; sem esta referência o
      // PDF.js não inicia a extração de texto no navegador.
      pdfjs.GlobalWorkerOptions.workerSrc = workerPdfUrl;
      const dadosArquivo = new Uint8Array(await arquivo.arrayBuffer());
      const documento = await pdfjs.getDocument({ data: dadosArquivo }).promise;
      const paginas = await Promise.all(
        Array.from({ length: documento.numPages }, async (_, indice) => {
          const pagina = await documento.getPage(indice + 1);
          const conteudo = await pagina.getTextContent();
          return conteudo.items.map((item) => ("str" in item ? item.str : "")).join("\n");
        }),
      );
      const dados = extrairDadosLibellula(paginas.join("\n"));
      if (!dados.codigo && !dados.nomeArquivo) {
        throw new Error("Não encontrei os campos do relatório Dados de Agrupamento.");
      }
      onImportar(dados);
      setEstado("pronto");
      setMensagem(`Dados de ${dados.codigo ?? "nest"} preenchidos. Confira somente a OP de cada peça e salve.`);
    } catch (erro) {
      setEstado("erro");
      setMensagem(erro instanceof Error ? erro.message : "Não foi possível ler esse PDF.");
    }
  }

  return (
    <div className="rounded-lg border border-cyan-400/30 bg-cyan-400/5 p-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-cyan-100">Importar relatório do Libellula</p>
          <p className="mt-0.5 text-xs text-slate-400">O PDF é lido aqui, preenche os dados técnicos e fica anexado ao nest como comprovante.</p>
        </div>
        <button type="button" onClick={() => inputRef.current?.click()} className="rounded bg-cyan-400 px-3 py-2 text-xs font-bold text-slate-950 transition hover:bg-cyan-300">
          Selecionar PDF
        </button>
      </div>
      <input
        ref={inputRef}
        type="file"
        name="arquivoPdf"
        accept="application/pdf,.pdf"
        className="sr-only"
        onChange={(event) => {
          const arquivo = event.currentTarget.files?.[0];
          if (arquivo) void importar(arquivo);
        }}
      />
      {estado !== "idle" && <p className={`mt-2 text-xs ${estado === "erro" ? "text-rose-200" : estado === "pronto" ? "text-emerald-200" : "text-cyan-200"}`}>{mensagem}</p>}
    </div>
  );
}
