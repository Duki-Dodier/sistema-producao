"use client";

import { useMemo, useState } from "react";
import { createApontamento } from "@/lib/actions/apontamentos";
import { sairSistema } from "@/lib/actions/auth";

export type ItemApontamentoOperador = {
  chave: string;
  opId: number;
  numeroSequencia: number;
  modeloCodigo: string;
  pecaId: number | null;
  roteiroEtapaId: number | null;
  pecaCodigo: string;
  pecaNome: string;
  necessario: number;
  processos: {
    codigo: string;
    label: string;
    apontado: number;
    estado: "concluido" | "atual" | "futuro";
  }[];
  proximoProcesso: string | null;
  proximoLabel: string;
  restante: number;
  concluido: boolean;
};

type OperadorKiosk = {
  id: number;
  nome: string;
  temPin: boolean;
  processosPermitidos: string[];
};

export function OperadorApontamentoKiosk({
  setorId,
  setorNome,
  operadores,
  sessao,
  itens,
  opIdInicial,
  pecaIdInicial,
  quantidadeInicial,
  modoQr = false,
}: {
  setorId: number;
  setorNome: string;
  operadores: OperadorKiosk[];
  sessao?: OperadorKiosk;
  itens: ItemApontamentoOperador[];
  opIdInicial?: number | null;
  pecaIdInicial?: number | null;
  quantidadeInicial?: number | null;
  modoQr?: boolean;
}) {
  const itemInicial = itens.find((item) =>
    !item.concluido &&
    (!Number.isInteger(opIdInicial) || item.opId === opIdInicial) &&
    (!Number.isInteger(pecaIdInicial) || item.pecaId === pecaIdInicial) &&
    (!sessao || sessao.processosPermitidos.includes(item.proximoProcesso ?? "PRODUCAO")),
  ) ?? null;
  const [busca, setBusca] = useState("");
  const [operador, setOperador] = useState(String(sessao?.id ?? ""));
  const [pin, setPin] = useState("");
  const [selecionado, setSelecionado] = useState<string | null>(
    itemInicial?.chave ?? null,
  );
  const [quantidade, setQuantidade] = useState(
    itemInicial && typeof quantidadeInicial === "number" && Number.isInteger(quantidadeInicial) && quantidadeInicial > 0
      ? String(Math.min(quantidadeInicial, itemInicial.restante))
      : "",
  );
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const operadorSelecionado = sessao ??
    operadores.find((opcao) => String(opcao.id) === operador) ?? null;
  const pinPendente = !sessao && Boolean(operadorSelecionado?.temPin) && pin.length !== 4;
  const itensPermitidos = useMemo(() => {
    if (!operadorSelecionado) return itens;
    const permitidos = new Set(operadorSelecionado.processosPermitidos);
    return itens.filter((opcao) => permitidos.has(opcao.proximoProcesso ?? "PRODUCAO"));
  }, [itens, operadorSelecionado]);
  const itensFiltrados = useMemo(() => {
    const termo = busca.trim().toLocaleLowerCase("pt-BR");
    if (!termo) return itensPermitidos;
    return itensPermitidos.filter((item) =>
      [item.numeroSequencia, item.modeloCodigo, item.pecaCodigo, item.pecaNome]
        .join(" ")
        .toLocaleLowerCase("pt-BR")
        .includes(termo),
    );
  }, [busca, itensPermitidos]);

  const item = itensPermitidos.find((opcao) => opcao.chave === selecionado) ?? null;

  const digitar = (valor: string) => {
    setQuantidade((atual) => {
      const proximo = `${atual}${valor}`.replace(/^0+(?=\d)/, "");
      return proximo.slice(0, 7);
    });
  };

  const confirmar = async (formData: FormData) => {
    setErro(null);
    setSucesso(null);
    setEnviando(true);
    try {
      const resultado = await createApontamento(formData);
      if (!resultado.ok) {
        setErro(resultado.error);
        return;
      }
      setSucesso(
        `${quantidade} peça(s) apontada(s) em ${item?.proximoLabel ?? "produção"}.`,
      );
      setQuantidade("");
      if (modoQr) {
        window.setTimeout(() => window.location.assign("/apontamentos/scanner"), 3000);
      }
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Não foi possível salvar o apontamento.");
    } finally {
      setEnviando(false);
    }
  };

  if (operadores.length === 0 && !sessao) {
    return (
      <div className="rounded-xl border border-amber-400/30 bg-amber-400/10 p-6 text-amber-100">
        Cadastre ao menos um funcionário ativo em {setorNome} antes de usar o apontamento do operador.
      </div>
    );
  }

  return (
    <div className="grid gap-3 sm:gap-5 xl:grid-cols-[minmax(360px,0.9fr)_minmax(520px,1.1fr)]">
      <section className={`rounded-xl border border-[#2d3449] bg-[#131b2e] p-4 ${modoQr ? "hidden lg:block" : ""}`}>
        <div className="mb-4 flex flex-wrap items-end gap-3">
          {sessao ? (
            <div className="flex min-w-48 flex-1 items-center justify-between gap-3 rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-3 py-3">
              <div>
                <div className="font-mono text-[10px] font-bold uppercase tracking-wider text-emerald-300">
                  Operador conectado
                </div>
                <div className="mt-1 text-base font-semibold text-white">{sessao.nome}</div>
              </div>
              <form action={sairSistema}>
                <button type="submit" className="rounded border border-emerald-300/30 px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-wider text-emerald-200 hover:bg-emerald-300/10">
                  Sair
                </button>
              </form>
            </div>
          ) : (
            <>
          <div className="min-w-48 flex-1">
            <label className="mb-1.5 block font-mono text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Quem está apontando
            </label>
            <select
              value={operador}
              onChange={(event) => {
                const proximoOperador = operadores.find((opcao) => String(opcao.id) === event.target.value);
                const permitidos = new Set(proximoOperador?.processosPermitidos ?? []);
                const primeiroItem = itens.find(
                  (opcao) => !opcao.concluido && permitidos.has(opcao.proximoProcesso ?? "PRODUCAO"),
                );
                setOperador(event.target.value);
                setPin("");
                setSelecionado(primeiroItem?.chave ?? null);
                setQuantidade("");
                setErro(null);
                setSucesso(null);
              }}
              className="w-full rounded-lg border border-[#3d494c] bg-[#060e20] px-3 py-3 text-base text-white outline-none focus:border-[#4cd7f6]"
            >
              <option value="">Selecione o operador</option>
              {operadores.map((opcao) => (
                <option key={opcao.id} value={opcao.id}>{opcao.nome}</option>
              ))}
            </select>
          </div>
          <div className="w-28">
            <label className="mb-1.5 block font-mono text-[10px] font-bold uppercase tracking-wider text-slate-500">
              PIN
            </label>
            <input
              type="password"
              inputMode="numeric"
              value={pin}
              onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 4))}
              placeholder="••••"
              className="w-full rounded-lg border border-[#3d494c] bg-[#060e20] px-3 py-3 text-center font-mono text-base tracking-[0.4em] text-white outline-none placeholder:text-slate-600 focus:border-[#4cd7f6]"
            />
          </div>
            </>
          )}
          <div className="min-w-52 flex-1">
            <label className="mb-1.5 block font-mono text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Buscar OP, engate ou peça
            </label>
            <input
              value={busca}
              onChange={(event) => setBusca(event.target.value)}
              placeholder="Ex.: 4502 ou AD1001"
              className="w-full rounded-lg border border-[#3d494c] bg-[#060e20] px-3 py-3 text-base text-white outline-none placeholder:text-slate-600 focus:border-[#4cd7f6]"
            />
          </div>
        </div>

        {operadorSelecionado && operadorSelecionado.processosPermitidos.length === 0 && (
          <p className="mb-3 rounded-lg border border-amber-400/30 bg-amber-400/10 p-3 text-xs text-amber-200">
            Nenhum processo foi autorizado para este operador. Cadastre as permissões em Configurações.
          </p>
        )}
        <div className="max-h-[610px] space-y-2 overflow-y-auto pr-1">
          {itensFiltrados.map((opcao) => {
            const ativo = opcao.chave === selecionado;
            return (
              <button
                key={opcao.chave}
                type="button"
                onClick={() => {
                  setSelecionado(opcao.chave);
                  setQuantidade("");
                  setErro(null);
                  setSucesso(null);
                }}
                className={`w-full rounded-lg border p-3 text-left transition ${
                  ativo
                    ? "border-[#4cd7f6] bg-[#4cd7f6]/10 shadow-[0_0_14px_rgba(76,215,246,0.15)]"
                    : "border-[#2d3449] bg-[#0b1326] hover:border-slate-500"
                } ${opcao.concluido ? "opacity-60" : ""}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-mono text-xs font-bold text-[#4cd7f6]">
                      OP {opcao.numeroSequencia} · {opcao.modeloCodigo}
                    </div>
                    <div className="mt-1 text-sm font-semibold text-white">
                      {opcao.pecaCodigo} · {opcao.pecaNome}
                    </div>
                  </div>
                  <span className={`rounded px-2 py-1 font-mono text-[10px] font-bold uppercase ${
                    opcao.concluido
                      ? "bg-emerald-400/15 text-emerald-300"
                      : "bg-amber-400/15 text-amber-300"
                  }`}>
                    {opcao.concluido ? "Concluído" : `${opcao.restante} pendentes`}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {opcao.processos.map((processo) => (
                    <span
                      key={processo.codigo}
                      className={`rounded px-2 py-1 font-mono text-[9px] font-bold uppercase tracking-wider ${
                        processo.estado === "concluido"
                          ? "bg-emerald-400/15 text-emerald-300"
                          : processo.estado === "atual"
                            ? "bg-amber-400/15 text-amber-300 ring-1 ring-amber-400/30"
                            : "bg-white/5 text-slate-600"
                      }`}
                    >
                      {processo.estado === "concluido" ? "✓ " : ""}{processo.label}
                    </span>
                  ))}
                </div>
              </button>
            );
          })}
          {itensFiltrados.length === 0 && (
            <p className="py-12 text-center text-sm text-slate-500">
              Nenhuma OP ou peça encontrada neste setor.
            </p>
          )}
        </div>
      </section>

      <section className={`rounded-xl border border-[#2d3449] bg-[#131b2e] p-3 sm:p-5 ${modoQr ? "order-first lg:order-none" : ""}`}>
        {!item ? (
          <div className="flex min-h-96 items-center justify-center text-slate-500">
            {modoQr ? "Nenhum processo disponível para este operador neste QR Code." : "Selecione uma OP para apontar."}
          </div>
        ) : item.concluido ? (
          <div className="flex min-h-96 flex-col items-center justify-center text-center">
            <span className="text-5xl text-emerald-300">✓</span>
            <h2 className="mt-4 text-xl font-bold text-white">Peça concluída</h2>
            <p className="mt-2 text-sm text-slate-400">
              Todos os processos de {item.pecaCodigo} já atingiram a quantidade necessária.
            </p>
          </div>
        ) : (
          <form action={confirmar}>
            <input type="hidden" name="setorId" value={setorId} />
            <input type="hidden" name="opId" value={item.opId} />
            <input type="hidden" name="pecaId" value={item.pecaId ?? ""} />
            <input type="hidden" name="roteiroEtapaId" value={item.roteiroEtapaId ?? ""} />
            <input type="hidden" name="processo" value={item.proximoProcesso ?? ""} />
            <input type="hidden" name="funcionarioId" value={operador} />
            <input type="hidden" name="pin" value={pin} />
            <input type="hidden" name="usarSessao" value={sessao ? "1" : ""} />
            <input type="hidden" name="quantidadeBoa" value={quantidade} />

            <div className="rounded-lg border border-[#2d3449] bg-[#0b1326] p-3 sm:p-4">
              {Number.isInteger(opIdInicial) && (
                <div className="mb-3 inline-flex rounded bg-[#4cd7f6]/10 px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-wider text-[#4cd7f6]">
                  OP carregada pelo QR Code
                </div>
              )}
              <div className="font-mono text-xs font-bold text-[#4cd7f6]">
                OP {item.numeroSequencia} · {item.modeloCodigo}
              </div>
              <h2 className="mt-1 text-lg font-bold text-white sm:text-xl">{item.pecaNome}</h2>
              {modoQr && sessao && (
                <p className="mt-2 text-xs text-emerald-300">Operador: {sessao.nome}</p>
              )}
              <div className="mt-4 flex items-center justify-between gap-4">
                <div>
                  <div className="font-mono text-[10px] uppercase tracking-wider text-slate-500">Processo a apontar</div>
                  <div className="mt-1 text-lg font-bold text-amber-300">{item.proximoLabel}</div>
                </div>
                <div className="text-right">
                  <div className="font-mono text-[10px] uppercase tracking-wider text-slate-500">Quantidade pendente</div>
                  <div className="mt-1 font-mono text-2xl font-bold text-white">{item.restante}</div>
                </div>
              </div>
            </div>

            <div className="mt-4 grid gap-3 sm:mt-5 sm:gap-4 md:grid-cols-[1fr_280px]">
              <div>
                <label className="font-mono text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Quantidade executada
                </label>
                <input
                  inputMode="numeric"
                  value={quantidade}
                  onChange={(event) => setQuantidade(event.target.value.replace(/\D/g, "").slice(0, 7))}
                  placeholder="0"
                  className="mt-2 w-full rounded-xl border border-[#3d494c] bg-[#060e20] px-5 py-4 text-center font-mono text-4xl font-bold text-white outline-none focus:border-[#4cd7f6] sm:py-6 sm:text-5xl"
                />
                <button
                  type="button"
                  onClick={() => setQuantidade(String(item.restante))}
                  className="mt-3 w-full rounded-lg border border-[#4cd7f6]/40 bg-[#4cd7f6]/10 py-3 font-mono text-xs font-bold uppercase tracking-wider text-[#4cd7f6]"
                >
                  Usar toda a quantidade pendente ({item.restante})
                </button>
                {erro && <p role="alert" className="mt-3 rounded bg-red-500/10 p-3 text-sm text-red-300">{erro}</p>}
                {sucesso && (
                  <div role="status" className="mt-3 rounded-lg border border-emerald-400/30 bg-emerald-500/10 p-3 text-sm text-emerald-200">
                    <p>{sucesso}</p>
                    {modoQr && (
                      <button
                        type="button"
                        onClick={() => window.location.assign("/apontamentos/scanner")}
                        className="mt-3 w-full rounded-md border border-emerald-300/40 px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-wider text-emerald-100 hover:bg-emerald-300/10"
                      >
                        Ler próximo QR Code
                      </button>
                    )}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-3 gap-2">
                {["7", "8", "9", "4", "5", "6", "1", "2", "3"].map((numero) => (
                  <button
                    key={numero}
                    type="button"
                    onClick={() => digitar(numero)}
                    className="rounded-lg border border-[#2d3449] bg-[#1b2940] py-3 font-mono text-xl font-bold text-white hover:border-[#4cd7f6] hover:bg-[#243650] sm:py-4"
                  >
                    {numero}
                  </button>
                ))}
                <button type="button" onClick={() => setQuantidade("")} className="rounded-lg border border-red-400/20 bg-red-400/10 font-mono text-[10px] font-bold uppercase text-red-300">Limpar</button>
                <button type="button" onClick={() => digitar("0")} className="rounded-lg border border-[#2d3449] bg-[#1b2940] py-3 font-mono text-xl font-bold text-white hover:border-[#4cd7f6] sm:py-4">0</button>
                <button type="button" onClick={() => setQuantidade((valor) => valor.slice(0, -1))} className="rounded-lg border border-[#2d3449] bg-[#1b2940] font-mono text-lg text-slate-300">⌫</button>
              </div>
            </div>

            <button
              type="submit"
              disabled={!operador || pinPendente || !quantidade || enviando}
              className={`mt-5 w-full rounded-xl bg-[#0ea5c9] py-4 font-mono text-sm font-bold uppercase tracking-[0.12em] text-white shadow-[0_0_18px_rgba(14,165,201,0.25)] transition hover:bg-[#0891b2] disabled:cursor-not-allowed disabled:opacity-40 ${modoQr ? "sticky bottom-3 z-10" : ""}`}
            >
              {enviando
                ? "Salvando..."
                : !operador
                  ? "Selecione o operador"
                  : pinPendente
                    ? "Digite o PIN de 4 dígitos"
                    : "Confirmar apontamento"}
            </button>
          </form>
        )}
      </section>
    </div>
  );
}
