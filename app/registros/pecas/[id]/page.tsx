import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { updatePeca } from "@/lib/actions/pecas";
import { PageHeader } from "@/components/page-header";
import { Card, CardHeader } from "@/components/card";
import { SubmitButton } from "@/components/submit-button";
import { Thumb } from "@/components/thumb";
import { TIPO_MATERIAL_LABEL } from "@/lib/labels";
import { PROCESSOS, PROCESSO_LABEL } from "@/lib/processos";
import { roteiroPadraoDaPeca } from "@/lib/roteiro-peca";

export default async function EditarPecaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const pecaId = Number(id);

  const [peca, setores] = await Promise.all([
    prisma.peca.findUnique({
      where: { id: pecaId },
      include: {
        roteiro: { orderBy: { ordem: "asc" } },
        setor: true,
        curvas: { orderBy: { ordem: "asc" } },
      },
    }),
    prisma.setor.findMany({ orderBy: { ordemPadrao: "asc" } }),
  ]);

  if (!peca) notFound();

  const boundUpdatePeca = updatePeca.bind(null, peca.id);
  const roteiroAtual = peca.roteiro.length > 0
    ? peca.roteiro
    : roteiroPadraoDaPeca(peca, setores);
  const linhasRoteiro = Array.from({ length: Math.max(8, roteiroAtual.length) }, (_, indice) =>
    roteiroAtual[indice] ?? null,
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`Editar peça ${peca.codigo}`}
        subtitle="Ajuste foto, nome, medida e setor desta peça."
      />

      <Card className="mx-auto w-full max-w-3xl">
        <CardHeader title="Dados da peça" />
        <form
          action={boundUpdatePeca}
          className="flex flex-col items-center gap-4 p-6"
        >
          <Thumb src={peca.imagemUrl} alt={peca.codigo} size={96} />
          <input
            name="imagem"
            type="file"
            accept="image/*"
            className="text-xs text-slate-500 file:mr-2 file:rounded-md file:border-0 file:bg-slate-100 file:px-2 file:py-1.5 file:text-xs file:font-medium file:text-slate-300 hover:file:bg-slate-200"
          />

          <div className="grid w-full grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-slate-400">Código</label>
              <input
                name="codigo"
                required
                defaultValue={peca.codigo}
                className="rounded-md border border-white/5 px-3 py-2 text-sm font-mono shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-slate-400">Nome</label>
              <input
                name="nome"
                required
                defaultValue={peca.nome}
                className="rounded-md border border-white/5 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-slate-400">
                Fabricada em
              </label>
              <select
                name="setorId"
                required
                defaultValue={peca.setorId}
                className="rounded-md border border-white/5 bg-[#1A222C] px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {setores.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nome}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-slate-400">
                Tipo de material
              </label>
              <select
                name="tipoMaterial"
                defaultValue={peca.tipoMaterial ?? ""}
                className="rounded-md border border-white/5 bg-[#1A222C] px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">—</option>
                {Object.entries(TIPO_MATERIAL_LABEL).map(([v, label]) => (
                  <option key={v} value={v}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="w-full border-t border-white/5 pt-4">
            <p className="text-xs font-medium text-slate-300">
              Roteiro da peça entre setores
            </p>
            <p className="mb-3 mt-1 text-[11px] text-slate-500">
              Preencha na ordem real. Linhas vazias são ignoradas. Toda peça deve terminar em Agrupamento.
            </p>
            <div className="mb-5 space-y-2">
              {linhasRoteiro.map((etapa, indice) => (
                <div key={indice} className="grid grid-cols-[38px_1fr_1fr] items-center gap-2">
                  <span className="text-center font-mono text-xs font-bold text-slate-500">{indice + 1}</span>
                  <select
                    name="etapaSetorId"
                    defaultValue={etapa?.setorId ?? ""}
                    className="rounded-md border border-white/5 bg-[#1A222C] px-3 py-2 text-sm text-slate-200"
                  >
                    <option value="">— Setor —</option>
                    {setores.map((setor) => <option key={setor.id} value={setor.id}>{setor.nome}</option>)}
                  </select>
                  <select
                    name="etapaProcesso"
                    defaultValue={etapa?.processo ?? ""}
                    className="rounded-md border border-white/5 bg-[#1A222C] px-3 py-2 text-sm text-slate-200"
                  >
                    <option value="">— Processo —</option>
                    {PROCESSOS.map((processo) => <option key={processo} value={processo}>{PROCESSO_LABEL[processo]}</option>)}
                  </select>
                </div>
              ))}
            </div>
            <p className="mb-2 text-xs font-medium text-slate-400">
              Medidas estruturadas (permitem buscar/filtrar por material igual)
            </p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-slate-500">Larg./diâm. (mm)</label>
                <input
                  name="medidaA"
                  type="number"
                  step="0.1"
                  defaultValue={peca.medidaA ?? ""}
                  className="rounded-md border border-white/5 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-slate-500">Altura (mm)</label>
                <input
                  name="medidaB"
                  type="number"
                  step="0.1"
                  defaultValue={peca.medidaB ?? ""}
                  className="rounded-md border border-white/5 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-slate-500">Espessura (mm)</label>
                <input
                  name="espessuraMm"
                  type="number"
                  step="0.1"
                  defaultValue={peca.espessuraMm ?? ""}
                  className="rounded-md border border-white/5 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-slate-500">Comprimento (mm)</label>
                <input
                  name="comprimentoMm"
                  type="number"
                  step="0.1"
                  defaultValue={peca.comprimentoMm ?? ""}
                  className="rounded-md border border-white/5 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="mt-3 flex flex-col gap-1.5">
              <label className="text-xs text-slate-500">Medida (texto de exibição)</label>
              <input
                name="medida"
                defaultValue={peca.medida ?? ""}
                placeholder="Ex.: 200mm"
                className="rounded-md border border-white/5 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div className="mt-3 flex flex-col gap-1.5">
              <label className="text-xs text-slate-500">
                Observação da ficha técnica (sai impressa na OP)
              </label>
              <input
                name="observacao"
                defaultValue={peca.observacao ?? ""}
                placeholder="Ex.: CORTE EM GRAU, ITEM RETO"
                className="rounded-md border border-white/5 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="w-full border-t border-white/5 pt-4">
            <p className="text-xs font-medium text-slate-300">Curvas de dobra</p>
            <p className="mb-3 mt-1 text-[11px] text-slate-500">
              Tabela &quot;Dobra&quot; da folha do Tubo na OP impressa. Linhas vazias são ignoradas.
            </p>
            <div className="space-y-2">
              <div className="grid grid-cols-[38px_1fr_1fr_1fr_1fr] gap-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                <span className="text-center">#</span>
                <span>Medida (cm)</span>
                <span>Ângulo (grau)</span>
                <span>Quant.</span>
                <span>Máquina</span>
              </div>
              {Array.from({ length: Math.max(4, peca.curvas.length + 1) }, (_, indice) => {
                const curva = peca.curvas[indice] ?? null;
                return (
                  <div key={indice} className="grid grid-cols-[38px_1fr_1fr_1fr_1fr] items-center gap-2">
                    <span className="text-center font-mono text-xs font-bold text-slate-500">{indice + 1}</span>
                    <input
                      name="curvaMedida"
                      type="number"
                      step="0.1"
                      defaultValue={curva?.medidaCm ?? ""}
                      className="rounded-md border border-white/5 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    <input
                      name="curvaAngulo"
                      type="number"
                      step="0.1"
                      defaultValue={curva?.anguloGraus ?? ""}
                      className="rounded-md border border-white/5 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    <input
                      name="curvaQuantidade"
                      type="number"
                      min={1}
                      defaultValue={curva?.quantidade ?? ""}
                      placeholder="1"
                      className="rounded-md border border-white/5 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    <input
                      name="curvaMaquina"
                      defaultValue={curva?.maquina ?? ""}
                      placeholder="Ex.: CV1"
                      className="rounded-md border border-white/5 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                );
              })}
            </div>
          </div>

          <SubmitButton>Salvar peça</SubmitButton>
        </form>
      </Card>
    </div>
  );
}
