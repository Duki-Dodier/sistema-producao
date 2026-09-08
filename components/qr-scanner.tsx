"use client";

import { BrowserQRCodeReader, type IScannerControls } from "@zxing/browser";
import { useEffect, useRef, useState } from "react";

type ModoScanner = "apontamento" | "conferencia";
type StatusScanner = "parado" | "iniciando" | "ativo" | "navegando";

type DadosQr = {
  op?: number | string;
  nest?: number | string;
  setor?: number | string;
  peca?: number | string;
  quantidade?: number | string;
};

function destinoApontamento(op: number | string, setor?: number | string, peca?: number | string, quantidade?: number | string) {
  const params = new URLSearchParams({ origem: "qrcode" });
  if (setor) params.set("setor", String(setor));
  if (peca) params.set("peca", String(peca));
  if (quantidade) params.set("quantidade", String(quantidade));
  return `/apontamentos?op=${encodeURIComponent(String(op))}&${params.toString()}`;
}

function numeroValido(valor: unknown) {
  return /^\d+$/.test(String(valor ?? ""));
}

function destinoDoQr(valor: string, modo: ModoScanner) {
  const texto = valor.trim();
  if (!texto) return null;

  try {
    const dados = JSON.parse(texto) as DadosQr;
    if (dados && numeroValido(dados.nest)) {
      return `/plasma/operar/${encodeURIComponent(String(dados.nest))}?origem=qrcode`;
    }
    if (dados && numeroValido(dados.op)) {
      if (modo === "conferencia") {
        return destinoApontamento(dados.op!, dados.setor, dados.peca, dados.quantidade);
      }
      const params = new URLSearchParams({ origem: "qrcode", op: String(dados.op) });
      if (dados.setor) params.set("setor", String(dados.setor));
      if (dados.peca) params.set("peca", String(dados.peca));
      if (dados.quantidade) params.set("quantidade", String(dados.quantidade));
      return `/apontamentos?${params.toString()}`;
    }
  } catch {
    // QR codes antigos usam uma URL ou somente a query string.
  }

  try {
    const valorComoUrl = /^op=/i.test(texto) ? `/apontamentos?${texto}` : texto;
    const url = new URL(valorComoUrl, window.location.origin);
    const op = url.searchParams.get("op");
    const rotaNest = /^\/plasma\/operar\/(\d+)$/.exec(url.pathname);

    if (rotaNest) {
      const params = new URLSearchParams(url.searchParams);
      params.set("origem", "qrcode");
      return `${url.pathname}?${params.toString()}`;
    }

    if (url.pathname !== "/apontamentos" || !numeroValido(op)) return null;
    if (modo === "conferencia") {
      return destinoApontamento(
        op!,
        url.searchParams.get("setor") ?? undefined,
        url.searchParams.get("peca") ?? undefined,
        url.searchParams.get("quantidade") ?? undefined,
      );
    }

    const params = new URLSearchParams(url.searchParams);
    params.set("origem", "qrcode");
    return `/apontamentos?${params.toString()}`;
  } catch {
    return null;
  }
}

function formatarCodigo(valor: string) {
  return valor.length > 72 ? `${valor.slice(0, 72)}…` : valor;
}

export function QrScanner({
  modo = "apontamento",
  iniciarAutomaticamente = false,
}: {
  modo?: ModoScanner;
  iniciarAutomaticamente?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const readerRef = useRef<BrowserQRCodeReader | null>(null);
  const navegandoRef = useRef(false);
  const [status, setStatus] = useState<StatusScanner>("parado");
  const [erro, setErro] = useState<string | null>(null);
  const [codigoManual, setCodigoManual] = useState("");
  const [ultimoCodigo, setUltimoCodigo] = useState<string | null>(null);

  const pararCamera = (proximoStatus: StatusScanner = "parado") => {
    controlsRef.current?.stop();
    controlsRef.current = null;
    readerRef.current = null;
    const stream = videoRef.current?.srcObject as MediaStream | null;
    stream?.getTracks().forEach((track) => track.stop());
    if (videoRef.current) videoRef.current.srcObject = null;
    setStatus(proximoStatus);
  };

  const abrirDestino = (valor: string) => {
    if (navegandoRef.current) return true;
    const destino = destinoDoQr(valor, modo);
    if (!destino) {
      setErro(modo === "conferencia"
        ? "QR Code encontrado, mas ele não contém um link válido de OP do Plasma."
        : "QR Code encontrado, mas ele não contém um link válido de apontamento.");
      setUltimoCodigo(formatarCodigo(valor));
      return false;
    }

    navegandoRef.current = true;
    setErro(null);
    setUltimoCodigo(formatarCodigo(valor));
    pararCamera("navegando");
    window.setTimeout(() => window.location.replace(destino), 120);
    return true;
  };

  const iniciarCamera = async () => {
    if (navegandoRef.current || status === "iniciando" || status === "ativo") return;
    setErro(null);
    setUltimoCodigo(null);
    if (!window.isSecureContext) {
      setErro("A câmera só funciona em uma conexão segura (HTTPS).");
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setErro("Este navegador não permite acessar a câmera. Use HTTPS em um navegador atualizado.");
      return;
    }

    const video = videoRef.current;
    if (!video) {
      setErro("Câmera não encontrada. Atualize a página e tente novamente.");
      return;
    }

    setStatus("iniciando");
    try {
      const reader = new BrowserQRCodeReader();
      readerRef.current = reader;
      const controls = await reader.decodeFromConstraints(
        {
          audio: false,
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
        },
        video,
        (resultado) => {
          if (resultado && !navegandoRef.current) abrirDestino(resultado.getText());
        },
      );
      controlsRef.current = controls;
      if (!navegandoRef.current) setStatus("ativo");
    } catch (error) {
      pararCamera();
      setErro(error instanceof Error && error.name === "NotAllowedError"
        ? "Permita o acesso à câmera para ler o QR Code."
        : "Não foi possível abrir a câmera. Verifique as permissões do navegador e tente novamente.");
    }
  };

  useEffect(() => {
    const timer = iniciarAutomaticamente
      ? window.setTimeout(() => void iniciarCamera(), 120)
      : null;
    return () => {
      if (timer !== null) window.clearTimeout(timer);
      pararCamera();
    };
    // A câmera é iniciada somente quando a página solicitar o modo automático.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [iniciarAutomaticamente]);

  const statusTexto = status === "navegando"
    ? "QR Code lido. Abrindo apontamento..."
    : status === "iniciando"
      ? "Abrindo câmera..."
      : status === "ativo"
        ? "Aponte para o QR Code da OP ou do NEST"
        : "A câmera está pronta para iniciar";

  return (
    <div className="w-full max-w-xl rounded-2xl border border-[#2d3449] bg-[#0b1326] p-4 shadow-2xl sm:p-6">
      <div className="mb-4 rounded-xl border border-cyan-400/20 bg-cyan-400/5 px-4 py-3 text-center">
        <p className="font-mono text-[11px] font-bold uppercase tracking-wider text-cyan-200">{statusTexto}</p>
        <p className="mt-1 text-xs text-slate-400">Centralize o código dentro da moldura e aguarde a abertura do apontamento.</p>
      </div>

      <div className="relative aspect-square overflow-hidden rounded-xl border border-cyan-400/30 bg-black">
        <video ref={videoRef} muted playsInline className={`h-full w-full object-cover ${status === "ativo" ? "block" : "hidden"}`} />
        {status === "ativo" ? (
          <div className="pointer-events-none absolute inset-8 rounded-2xl border-2 border-cyan-300/80 shadow-[0_0_30px_rgba(76,215,246,0.25)]">
            <span className="absolute -top-7 left-0 rounded bg-black/70 px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-cyan-200">Centralize o QR Code</span>
            <div className="absolute left-2 right-2 top-1/2 h-0.5 animate-pulse bg-cyan-300" />
          </div>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 px-8 text-center text-slate-500">
            <span className="text-5xl text-cyan-300">▣</span>
            <p className="text-sm">{status === "navegando" ? "Carregando o apontamento..." : "Posicione o QR Code inteiro dentro da moldura."}</p>
          </div>
        )}
      </div>

      {erro && <p role="alert" className="mt-4 rounded-lg border border-amber-400/30 bg-amber-400/10 p-3 text-sm text-amber-200">{erro}</p>}
      {ultimoCodigo && status !== "navegando" && <p className="mt-3 rounded-lg border border-slate-700 bg-slate-900/60 p-3 text-xs text-slate-400">Código lido: <span className="font-mono text-slate-200">{ultimoCodigo}</span></p>}

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        {status === "ativo" ? (
          <button type="button" onClick={() => pararCamera()} className="w-full rounded-xl border border-slate-600 px-4 py-3 font-mono text-xs font-bold uppercase tracking-wider text-slate-300 hover:bg-white/5">
            Parar câmera
          </button>
        ) : (
          <button type="button" onClick={iniciarCamera} disabled={status === "iniciando" || status === "navegando"} className="w-full rounded-xl bg-[#0ea5c9] px-4 py-3 font-mono text-xs font-bold uppercase tracking-wider text-white hover:bg-[#0891b2] disabled:opacity-60">
            {status === "iniciando" ? "Abrindo câmera..." : status === "navegando" ? "Abrindo apontamento..." : "Abrir câmera"}
          </button>
        )}
      </div>

      <div className="mt-5 border-t border-white/10 pt-4">
        <label className="font-mono text-[10px] font-bold uppercase tracking-wider text-slate-500">Alternativa: colar o conteúdo do QR Code</label>
        <div className="mt-2 flex gap-2">
          <input
            value={codigoManual}
            onChange={(event) => setCodigoManual(event.target.value)}
            placeholder="Cole aqui o link do QR Code"
            className="min-w-0 flex-1 rounded-xl border border-[#3d494c] bg-[#060e20] px-3 py-3 text-xs text-white outline-none placeholder:text-slate-600 focus:border-[#4cd7f6]"
          />
          <button type="button" onClick={() => abrirDestino(codigoManual)} className="rounded-xl border border-cyan-400/40 bg-cyan-400/10 px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-wider text-cyan-200 hover:bg-cyan-400/20">
            Usar link
          </button>
        </div>
      </div>
      <p className="mt-3 text-center text-[11px] leading-5 text-slate-500">
        Use boa iluminação, mantenha o celular firme e deixe uma pequena margem branca ao redor do QR Code.
      </p>
    </div>
  );
}
