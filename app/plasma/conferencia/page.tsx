import Link from "next/link";
import { sairSistema } from "@/lib/actions/auth";
import { buscarOperadorLogado } from "@/lib/auth-operador";
import { buscarFilaConferenciaPlasma } from "@/lib/plasma-conferencia-fabrica";
import { podeConferirPlasma } from "@/lib/plasma-regras";
import { prisma } from "@/lib/prisma";
import { ehSetor } from "@/lib/setores";

function numero(valor: number) {
  return new Intl.NumberFormat("pt-BR").format(valor);
}

export default async function PlasmaConferenciaPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const [usuario, setores, sp] = await Promise.all([
    buscarOperadorLogado(),
    prisma.setor.findMany({ select: { id: true, nome: true } }),
    searchParams,
  ]);
  const setor = setores.find((item) => ehSetor(item.nome, "Plasma Chapa"));
  const autorizado = podeConferirPlasma(usuario);
  const fila = setor && autorizado ? await buscarFilaConferenciaPlasma(setor.id) : [];

  return (
    <main className="min-h-full bg-[#07101f] px-4 py-5 text-slate-100 sm:px-6 sm:py-8">
      <div className="mx-auto w-full max-w-xl space-y-5">
        <header className="flex items-center justify-between gap-3">
          <div>
            <p className="font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-amber-300">Plasma Chapa</p>
            <h1 className="mt-1 text-2xl font-black text-white">Peças para conferir</h1>
          </div>
          <div className="flex items-center gap-2">
            <span className="max-w-28 truncate text-right text-xs font-semibold text-slate-300">{usuario?.nome}</span>
            <form action={sairSistema}>
              <button type="submit" className="min-h-10 rounded-xl border border-slate-600 px-3 text-xs font-bold text-slate-300 transition hover:border-slate-400 hover:text-white">Sair</button>
            </form>
          </div>
        </header>

        {!autorizado || !setor ? (
          <section className="rounded-2xl border border-amber-300/30 bg-amber-300/10 p-5 text-amber-100">
            <p className="text-lg font-black">Acesso de conferente necessário</p>
            <p className="mt-2 text-sm leading-relaxed text-amber-100/75">Entre com o usuário do conferente do Plasma Chapa ou com um administrador para confirmar as peças.</p>
          </section>
        ) : (
          <>
            {sp.conferido === "1" && (
              <p role="status" className="rounded-2xl border border-emerald-300/30 bg-emerald-400/10 p-4 text-sm font-semibold text-emerald-100">Conferência registrada. A peça foi liberada para a fábrica.</p>
            )}

            <Link href="/plasma/conferencia/scanner" className="block min-h-16 rounded-2xl bg-amber-300 px-5 py-4 text-slate-950 shadow-lg shadow-amber-300/10 transition hover:bg-amber-200">
              <span className="block text-base font-black">Ler QR Code da OP</span><span className="mt-1 block text-sm font-semibold text-slate-800/75">Abrir câmera</span>
            </Link>

            <section className="overflow-hidden rounded-2xl border border-slate-700 bg-[#202a36] shadow-xl shadow-black/15">
              <header className="flex items-center justify-between gap-3 border-b border-slate-700/80 px-5 py-4">
                <div>
                  <p className="text-base font-black text-white">Prontas para conferência</p>
                  <p className="mt-1 text-sm text-slate-400">Somente peças com corte e reposição concluídos.</p>
                </div>
                <span className="rounded-xl border border-amber-300/30 bg-amber-300/10 px-3 py-2 text-sm font-black text-amber-100">{fila.length}</span>
              </header>

              {fila.length ? (
                <div className="divide-y divide-slate-700/80">
                  {fila.map((item) => (
                    <article key={`${item.opId}-${item.pecaId}`} className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-mono text-xs font-bold uppercase tracking-wide text-cyan-200">OP {item.numeroSequencia} · lote {item.lote ?? "—"}</p>
                          <h2 className="mt-2 truncate text-lg font-black text-white">{item.pecaCodigo}</h2>
                          <p className="mt-1 truncate text-sm text-slate-400">{item.pecaNome} · {item.modeloCodigo}</p>
                        </div>
                        <div className="shrink-0 text-right"><p className="text-2xl font-black text-amber-100">{numero(item.necessaria)}</p><p className="text-xs text-amber-100/75">peças</p></div>
                      </div>
                      <Link href={`/apontamentos?origem=lista&op=${item.opId}&setor=${setor.id}&peca=${item.pecaId}`} className="mt-4 flex min-h-12 items-center justify-center rounded-xl border border-cyan-300/35 bg-cyan-400/10 px-4 py-3 text-sm font-black text-cyan-100 transition hover:bg-cyan-400/20">Conferir peça</Link>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="px-6 py-14 text-center">
                  <p className="text-lg font-black text-slate-200">Nenhuma peça pronta agora</p>
                  <p className="mt-2 text-sm leading-relaxed text-slate-500">Quando o operador concluir o corte e a reposição completar a OP, a peça aparecerá aqui.</p>
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}
