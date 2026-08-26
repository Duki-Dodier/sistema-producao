"use client";

import { useEffect, useRef, useState } from "react";

type Barcode = { rawValue?: string };
type BarcodeDetectorInstance = {
  detect: (source: HTMLVideoElement | HTMLCanvasElement) => Promise<Barcode[]>;
};
type BarcodeDetectorConstructor = new (options?: { formats?: string[] }) => BarcodeDetectorInstance;

declare global {
  interface Window {
    BarcodeDetector?: BarcodeDetectorConstructor;
  }
}

function destinoDoQr(valor: string) {
  const texto = valor.trim();
  if (!texto) return null;

  try {
    const dados = JSON.parse(texto) as { op?: number | string; setor?: number | string; peca?: number | string; quantidade?: number | string };
    if (dados && dados.op) {
      const params = new URLSearchParams({ origem: "qrcode", op: String(dados.op) });
      if (dados.setor) params.set("setor", String(dados.setor));
      if (dados.peca) params.set("peca", String(dados.peca));
      if (dados.quantidade) params.set("quantidade", String(dados.quantidade));
      return `/apontamentos?${params.toString()}`;
    }
  } catch {
    // QR codes antigos usam uma URL; seguimos para esse formato abaixo.
  }

  try {
    const valorComoUrl = /^op=/i.test(texto) ? `/apontamentos?${texto}` : texto;
    const url = new URL(valorComoUrl, window.location.origin);
    const op = url.searchParams.get("op");
    if (url.pathname !== "/apontamentos" || !op || !/^\d+$/.test(op)) return null;
    url.searchParams.set("origem", "qrcode");
    return `${url.pathname}?${url.searchParams.toString()}`;
  } catch {
    return null;
  }
}

function formatarCodigo(valor: string) {
  return valor.length > 72 ? `${valor.slice(0, 72)}…` : valor;
}

export function QrScanner() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);
  const ativoRef = useRef(false);
  const processandoRef = useRef(false);
  const [status, setStatus] = useState<"parado" | "iniciando" | "ativo">("parado");
  const [erro, setErro] = useState<string | null>(null);
  const [codigoManual, setCodigoManual] = useState("");
  const [ultimoCodigo, setUltimoCodigo] = useState<string | null>(null);

  const pararCamera = () => {
    ativoRef.current = false;
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setStatus("parado");
  };

  const abrirDestino = (valor: string) => {
    const destino = destinoDoQr(valor);
    if (!destino) {
      setErro("QR Code encontrado, mas ele não contém um link válido de apontamento.");
      setUltimoCodigo(formatarCodigo(valor));
      return false;
    }
    pararCamera();
    window.location.assign(destino);
    return true;
  };

  const iniciarCamera = async () => {
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

    setStatus("iniciando");
    try {
      let detector: BarcodeDetectorInstance | null = null;
      if (window.BarcodeDetector) {
        try {
          detector = new window.BarcodeDetector({ formats: ["qr_code"] });
        } catch {
          detector = new window.BarcodeDetector();
        }
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });
      streamRef.current = stream;
      const track = stream.getVideoTracks()[0];
      try {
        await track.applyConstraints({
          advanced: [{ focusMode: "continuous" } as MediaTrackConstraintSet],
        });
      } catch {
        // Alguns aparelhos não expõem foco contínuo; a câmera segue normalmente.
      }

      const video = videoRef.current;
      if (!video) throw new Error("Câmera não encontrada.");
      video.srcObject = stream;
      await video.play();
      ativoRef.current = true;
      setStatus("ativo");

      if (!detector) {
        setErro("A câmera foi aberta, mas este navegador não tem leitor automático. Cole o link do QR Code abaixo.");
      }

      const procurar = async () => {
        if (!ativoRef.current || !videoRef.current) return;
        if (detector && !processandoRef.current && videoRef.current.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
          processandoRef.current = true;
          try {
            const canvas = canvasRef.current;
            const fontes: (HTMLVideoElement | HTMLCanvasElement)[] = [videoRef.current];
            if (canvas && videoRef.current.videoWidth > 0 && videoRef.current.videoHeight > 0) {
              const lado = Math.min(videoRef.current.videoWidth, videoRef.current.videoHeight);
              const origemX = (videoRef.current.videoWidth - lado) / 2;
              const origemY = (videoRef.current.videoHeight - lado) / 2;
              canvas.width = 720;
              canvas.height = 720;
              canvas.getContext("2d")?.drawImage(videoRef.current, origemX, origemY, lado, lado, 0, 0, 720, 720);
              fontes.push(canvas);
            }
            for (const fonte of fontes) {
              const encontrados = await detector.detect(fonte);
              const codigo = encontrados.map((item) => item.rawValue?.trim() ?? "").find(Boolean);
              if (codigo && abrirDestino(codigo)) return;
            }
          } catch {
            // O detector pode falhar em um frame; a próxima tentativa continua.
          } finally {
            processandoRef.current = false;
          }
        }
        if (ativoRef.current) timerRef.current = window.setTimeout(procurar, 140);
      };
      void procurar();
    } catch (error) {
      pararCamera();
      setErro(error instanceof Error && error.name === "NotAllowedError"
        ? "Permita o acesso à câmera para ler o próximo QR Code."
        : "Não foi possível abrir a câmera. Verifique as permissões do navegador e tente novamente.");
    }
  };

  useEffect(() => () => pararCamera(), []);

  return (
    <div className="w-full max-w-xl rounded-2xl border border-[#2d3449] bg-[#0b1326] p-4 shadow-2xl sm:p-6">
      <div className="relative aspect-square overflow-hidden rounded-xl border border-cyan-400/30 bg-black">
        <video ref={videoRef} muted playsInline className={`h-full w-full object-cover ${status === "ativo" ? "block" : "hidden"}`} />
        <canvas ref={canvasRef} className="hidden" aria-hidden="true" />
        {status === "ativo" ? (
          <div className="pointer-events-none absolute inset-8 rounded-2xl border-2 border-cyan-300/80 shadow-[0_0_30px_rgba(76,215,246,0.25)]">
            <span className="absolute -top-7 left-0 rounded bg-black/70 px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-cyan-200">Centralize o QR Code</span>
            <div className="absolute left-2 right-2 top-1/2 h-0.5 animate-pulse bg-cyan-300" />
          </div>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 px-8 text-center text-slate-500">
            <span className="text-5xl text-cyan-300">▣</span>
            <p className="text-sm">Posicione o QR Code inteiro dentro da moldura.</p>
          </div>
        )}
      </div>

      {erro && <p role="alert" className="mt-4 rounded-lg border border-amber-400/30 bg-amber-400/10 p-3 text-sm text-amber-200">{erro}</p>}
      {ultimoCodigo && <p className="mt-3 rounded-lg border border-slate-700 bg-slate-900/60 p-3 text-xs text-slate-400">Código lido: <span className="font-mono text-slate-200">{ultimoCodigo}</span></p>}

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        {status === "ativo" ? (
          <button type="button" onClick={pararCamera} className="w-full rounded-xl border border-slate-600 px-4 py-3 font-mono text-xs font-bold uppercase tracking-wider text-slate-300 hover:bg-white/5">
            Parar câmera
          </button>
        ) : (
          <button type="button" onClick={iniciarCamera} disabled={status === "iniciando"} className="w-full rounded-xl bg-[#0ea5c9] px-4 py-3 font-mono text-xs font-bold uppercase tracking-wider text-white hover:bg-[#0891b2] disabled:opacity-60">
            {status === "iniciando" ? "Abrindo câmera..." : "Abrir câmera"}
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
