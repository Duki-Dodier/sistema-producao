import Link from "next/link";
import type { ConferenciaPlasmaFabrica } from "@/lib/plasma-conferencia-fabrica";
import { PlasmaConferenciaOPForm } from "@/components/plasma-conferencia-op-form";

function dataHora(valor: string) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(valor));
}

function numero(valor: number) {
  return new Intl.NumberFormat("pt-BR").format(valor);
}

export function PlasmaConferenciaApontamentoFabrica({
  dados,
  podeConferir,
}: {
  dados: ConferenciaPlasmaFabrica | null;
  podeConferir: boolean;
}) {
  if (!dados) {
    return (
      <section className="mx-auto w-full max-w-xl rounded-2xl border border-rose-300/30 bg-rose-400/10 p-5 text-rose-100">
        <p className="text-lg font-black">OP ou peça do Plasma Chapa não encontrada.</p>
        <p className="mt-2 text-sm text-rose-100/75">Leia novamente o QR Code da etapa Plasma Chapa ou escolha uma peça na lista de conferência.</p>
        <Link href="/plasma/conferencia" className="mt-4 inline-flex min-h-11 items-center rounded-xl border border-rose-200/40 px-4 py-2 text-sm font-bold transition hover:bg-rose-200/10">Voltar para a lista</Link>
      </section>
    );
  }

  const possuiLancamentos = dados.itens.some((item) => item.lancamentos.length > 0);
  const jaConferida = dados.pendentes === 0 && possuiLancamentos;

  return (
    <div className="mx-auto w-full max-w-xl space-y-4">
      <Link href="/plasma/conferencia" className="inline-flex text-sm font-semibold text-cyan-200 transition hover:text-cyan-100">← Voltar para peças a conferir</Link>

      <section className="overflow-hidden rounded-2xl border border-amber-300/30 bg-[#202a36] shadow-xl shadow-black/20">
        <header className="border-b border-amber-300/15 px-5 py-5">
          <p className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-amber-300">Conferência do Plasma Chapa</p>
          <h1 className="mt-2 text-2xl font-black text-white">OP {dados.numeroSequencia}</h1>
          <p className="mt-1 text-sm text-slate-300">Lote {dados.lote ?? "—"} · {dados.modeloCodigo}</p>
          <p className="mt-4 text-base font-bold text-white">{dados.pecaCodigo}</p>
          <p className="mt-1 text-sm text-slate-400">{dados.pecaNome}</p>
        </header>

        <div className="p-5">
          <div className="rounded-2xl border border-cyan-300/30 bg-cyan-400/10 px-5 py-4 text-center">
            <p className="text-sm font-semibold text-cyan-100">Quantidade da OP</p>
            <p className="mt-1 text-5xl font-black tracking-tight text-white">{numero(dados.necessaria)}</p>
            <p className="mt-1 text-sm text-cyan-100/75">peças</p>
          </div>

          <div className="mt-4">
            {!podeConferir ? (
              <p className="rounded-xl border border-amber-300/30 bg-amber-300/10 p-4 text-sm leading-relaxed text-amber-100">Somente o conferente do Plasma Chapa ou o administrador pode confirmar este recebimento.</p>
            ) : jaConferida ? (
              <p className="rounded-xl border border-emerald-300/30 bg-emerald-400/10 p-4 text-sm font-semibold text-emerald-100">Esta peça já foi conferida e liberada para a fábrica.</p>
            ) : dados.prontaParaConferir ? (
              <PlasmaConferenciaOPForm
                opId={dados.opId}
                pecaId={dados.pecaId}
                necessaria={dados.necessaria}
                totalLiberado={dados.totalLiberado}
              />
            ) : !possuiLancamentos ? (
              <p className="rounded-xl border border-amber-300/30 bg-amber-300/10 p-4 text-sm leading-relaxed text-amber-100">Ainda não há peças registradas pelo operador para esta OP.</p>
            ) : (
              <p className="rounded-xl border border-amber-300/30 bg-amber-300/10 p-4 text-sm leading-relaxed text-amber-100">Aguardando o corte ou a reposição completar a quantidade total desta OP.</p>
            )}
          </div>
        </div>
      </section>

      <details className="rounded-2xl border border-slate-700 bg-[#202a36]">
        <summary className="cursor-pointer list-none px-5 py-4 text-sm font-bold text-slate-100 marker:hidden">Ver rastreabilidade <span className="float-right text-cyan-200">+</span></summary>
        <div className="space-y-3 border-t border-slate-700/80 p-4">
          {dados.itens.map((item) => (
            <article key={item.id} className="rounded-xl border border-slate-700 bg-slate-950/25 p-3">
              <p className="font-mono text-sm font-black text-cyan-100">{item.nestCodigo}</p>
              <p className="mt-1 text-xs text-slate-400">{item.maquinaCodigo} · {item.maquinaNome}</p>
              {item.lancamentos.length ? item.lancamentos.map((lancamento) => {
                const boas = lancamento.quantidadeConferidaBoa ?? lancamento.quantidadeBoa;
                const perdas = lancamento.quantidadeConferidaRefugo ?? lancamento.quantidadeRefugo;
                return (
                  <div key={lancamento.id} className="mt-3 border-t border-slate-700/80 pt-3 text-sm">
                    <div className="flex items-start justify-between gap-3"><span className="font-semibold text-slate-100">{lancamento.operadorNome}</span><span className="text-cyan-100">{boas} boas</span></div>
                    <p className="mt-1 text-xs text-slate-500">{dataHora(lancamento.dataHora)} · {perdas} perda(s)</p>
                    {lancamento.conferenteNome && <p className="mt-1 text-xs text-emerald-200">Conferido por {lancamento.conferenteNome}{lancamento.conferidoEm ? ` · ${dataHora(lancamento.conferidoEm)}` : ""}</p>}
                  </div>
                );
              }) : <p className="mt-3 text-xs text-slate-500">Sem lançamento do operador.</p>}
            </article>
          ))}
          <p className="text-xs text-slate-500">Liberado: {numero(dados.totalLiberado)} · Boas aguardando confirmação: {numero(dados.totalBoasPendentes)} · Perdas registradas: {numero(dados.totalPerdasDeclaradas)}</p>
        </div>
      </details>
    </div>
  );
}
