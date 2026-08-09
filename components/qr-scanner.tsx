"use client";

import { useEffect, useRef, useState } from "react";

type Barcode = { rawValue?: string };
type BarcodeDetectorInstance = {
  detect: (source: HTMLVideoElement) => Promise<Barcode[]>;
};
type BarcodeDetectorConstructor = new (options?: { formats?: string[] }) => BarcodeDetectorInstance;

declare global {
  interface Window {
    BarcodeDetector?: BarcodeDetectorConstructor;
  }
}

function destinoDoQr(valor: string) {
  try {
    const url = new URL(valor, window.location.origin);
    if (url.pathname !== "/apontamentos" || !url.searchParams.get("op")) return null;
    url.searchParams.set("origem", "qrcode");
    return `${url.pathname}?${url.searchParams.toString()}`;
  } catch {
    return null;
  }
}

export function QrScanner() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);
  const ativoRef = useRef(false);
  const processandoRef = useRef(false);
  const [status, setStatus] = useState<"parado" | "iniciando" | "ativo" | "indisponivel">("parado");
  const [erro, setErro] = useState<string | null>(null);

  const pararCamera = () => {
    ativoRef.current = false;
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setStatus("parado");
  };

  const iniciarCamera = async () => {
    setErro(null);
    if (!window.isSecureContext) {
      setErro("A câmera só funciona em uma conexão segura (HTTPS).");
      return;
    }
    if (!window.BarcodeDetector) {
      setStatus("indisponivel");
      setErro("Este navegador não oferece leitura de QR Code pela câmera. Use o Chrome no celular ou leia o QR pela câmera do aparelho.");
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setErro("Este navegador não permite acessar a câmera.");
      return;
    }

    setStatus("iniciando");
    try {
      const detector = new window.BarcodeDetector({ formats: ["qr_code"] });
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) throw new Error("Câmera não encontrada.");
      video.srcObject = stream;
      await video.play();
      ativoRef.current = true;
      setStatus("ativo");

      const procurar = async () => {
        if (!ativoRef.current || !videoRef.current) return;
        if (!processandoRef.current && videoRef.current.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
          processandoRef.current = true;
          try {
            const encontrados = await detector.detect(videoRef.current);
            const destino = encontrados.map((item) => destinoDoQr(item.rawValue ?? "")).find(Boolean);
            if (destino) {
              pararCamera();
              window.location.assign(destino);
              return;
            }
          } catch {
            // A câmera continua tentando enquanto o QR não estiver enquadrado.
          } finally {
            processandoRef.current = false;
          }
        }
        if (ativoRef.current) timerRef.current = window.setTimeout(procurar, 250);
      };
      void procurar();
    } catch (error) {
      pararCamera();
      setErro(error instanceof Error && error.name === "NotAllowedError"
        ? "Permita o acesso à câmera para ler o próximo QR Code."
        : "Não foi possível abrir a câmera. Verifique as permissões do navegador.");
    }
  };

  useEffect(() => () => pararCamera(), []);

  return (
    <div className="w-full max-w-xl rounded-2xl border border-[#2d3449] bg-[#0b1326] p-4 shadow-2xl sm:p-6">
      <div className="relative aspect-square overflow-hidden rounded-xl border border-cyan-400/30 bg-black">
        <video ref={videoRef} muted playsInline className={`h-full w-full object-cover ${status === "ativo" ? "block" : "hidden"}`} />
        {status === "ativo" ? (
          <div className="pointer-events-none absolute inset-8 rounded-2xl border-2 border-cyan-300/80 shadow-[0_0_30px_rgba(76,215,246,0.25)]">
            <div className="absolute left-2 right-2 top-1/2 h-0.5 animate-pulse bg-cyan-300" />
          </div>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 px-8 text-center text-slate-500">
            <span className="text-5xl text-cyan-300">▣</span>
            <p className="text-sm">A câmera ficará aberta para ler o próximo QR Code.</p>
          </div>
        )}
      </div>

      {erro && <p role="alert" className="mt-4 rounded-lg border border-amber-400/30 bg-amber-400/10 p-3 text-sm text-amber-200">{erro}</p>}
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
      <p className="mt-3 text-center text-[11px] leading-5 text-slate-500">
        Aponte a câmera para o QR Code da OP. Ao identificar o código, o apontamento será carregado automaticamente.
      </p>
    </div>
  );
}
