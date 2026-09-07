import Link from "next/link";
import { QrScanner } from "@/components/qr-scanner";
import { buscarOperadorLogado } from "@/lib/auth-operador";
import { podeConferirPlasma } from "@/lib/plasma-regras";

export default async function PlasmaConferenciaScannerPage() {
  const usuario = await buscarOperadorLogado();
  if (!podeConferirPlasma(usuario)) {
    return (
      <div className="mx-auto flex min-h-full w-full max-w-xl flex-col justify-center gap-4 p-4 sm:p-6">
        <Link href="/plasma/conferencia" className="text-xs font-semibold text-cyan-200 transition hover:text-cyan-100">← Voltar para conferência</Link>
        <section className="rounded-xl border border-amber-400/30 bg-amber-400/10 p-5 text-amber-100">
          Somente o conferente designado do Plasma Chapa pode usar este scanner.
        </section>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-full w-full max-w-xl flex-col gap-4 p-4 sm:p-6">
      <div>
        <Link href="/plasma/conferencia" className="text-xs font-semibold text-cyan-200 transition hover:text-cyan-100">← Voltar para conferência</Link>
        <p className="mt-4 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-amber-300">Conferência · leitura móvel</p>
        <h1 className="mt-1 text-2xl font-bold uppercase text-white">LER QR CODE DA OP</h1>
        <p className="mt-1 text-sm text-slate-400">Aponte a câmera para o QR Code da peça do Plasma na ordem de produção.</p>
      </div>
      <QrScanner modo="conferencia" iniciarAutomaticamente />
    </div>
  );
}
