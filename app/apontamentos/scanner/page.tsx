import Link from "next/link";
import { QrScanner } from "@/components/qr-scanner";
import { buscarOperadorLogado } from "@/lib/auth-operador";

export default async function ScannerApontamentoPage() {
  const operador = await buscarOperadorLogado();
  const retorno = operador ? `/apontamentos?setor=${operador.setorId}` : "/apontamentos";

  return (
    <div className="flex min-h-full flex-col items-center justify-center gap-4 bg-[#07101f] p-4 sm:p-8">
      <div className="w-full max-w-xl">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-400">Apontamento móvel</p>
            <h1 className="mt-1 text-xl font-bold text-white">Ler próximo QR Code</h1>
          </div>
          <Link href={retorno} className="rounded-lg border border-slate-600 px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-wider text-slate-300 hover:bg-white/5">
            Voltar
          </Link>
        </div>
        <QrScanner />
      </div>
    </div>
  );
}
