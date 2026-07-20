"use client";

import { useMemo, useRef, useState } from "react";
import { createApontamento } from "@/lib/actions/apontamentos";
import { SubmitButton } from "@/components/submit-button";
import { PROCESSO_LABEL, processosDaPeca, type Processo } from "@/lib/processos";

type Operador = { id: number; nome: string };
type OpcaoOP = {
  id: number;
  numeroSequencia: number;
  lote: string | null;
  apontamentos?: { soldador: string | null }[];
  modelo: {
    codigo: string;
    pecas: {
      pecaId: number;
      peca: {
        codigo: string;
        nome: string;
        processos: string | null;
        tipoMaterial: string | null;
        setor: { nome: string };
      };
    }[];
  };
};

export function MonitorApontamentoForm({
  setorId,
  setorNome,
  operadores,
  ops,
}: {
  setorId: number;
  setorNome: string;
  operadores: Operador[];
  ops: OpcaoOP[];
}) {
  const [opId, setOpId] = useState("");
  const [buscaOp, setBuscaOp] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [pecaId, setPecaId] = useState("");
  const [processo, setProcesso] = useState("");
  
  const [usuario, setUsuario] = useState("");
  const [usuarioFixo, setUsuarioFixo] = useState(false);

  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const isSolda = setorNome.toLowerCase().includes("solda");

  // Filtra as OPs permitidas
  const opsFiltradas = useMemo(() => {
    return ops.filter((op) => {
      // Regra de bloqueio da Solda: Se for setor Solda e não tem soldador alocado, esconde a OP.
      if (isSolda) {
        const soldadorAlocado = op.apontamentos?.[0]?.soldador;
        if (!soldadorAlocado) return false;
      }
      return true;
    });
  }, [ops, isSolda]);

  // Resultados da busca
  const searchResults = useMemo(() => {
    if (!buscaOp) return [];
    const b = buscaOp.toLowerCase();
    return opsFiltradas
      .filter((op) =>
        String(op.numeroSequencia).includes(b) ||
        (op.lote && op.lote.toLowerCase().includes(b))
      )
      .slice(0, 8); // Top 8 results
  }, [buscaOp, opsFiltradas]);

  const opSelecionada = useMemo(
    () => ops.find((op) => String(op.id) === opId),
    [opId, ops],
  );
  const exigePeca = (opSelecionada?.modelo.pecas.length ?? 0) > 0;
  const pecaSelecionada = opSelecionada?.modelo.pecas.find(
    (item) => String(item.pecaId) === pecaId,
  )?.peca;
  const processos = pecaSelecionada ? processosDaPeca(pecaSelecionada) : [];

  const handleAction = async (formData: FormData) => {
    setErro(null);
    setSucesso(null);
    
    // Fallback if hidden input misses something
    if (usuarioFixo && usuario) {
      formData.set("usuario", usuario);
    }
    if (opId) {
      formData.set("opId", opId);
    } else {
      setErro("Selecione uma OP válida na lista.");
      return;
    }
    if (!usuarioFixo && !formData.get("usuario")) {
      setErro("Selecione o operador.");
      return;
    }

    try {
      await createApontamento(formData);
      setSucesso("Produção lançada com sucesso.");
      setOpId("");
      setBuscaOp("");
      setPecaId("");
      setProcesso("");
      setUsuarioFixo(false);
      setUsuario(""); // Reseta o usuário livre
      formRef.current?.reset();
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Não foi possível lançar a produção.");
    }
  };

  const handleSelectOp = (selectedOp: OpcaoOP) => {
    setBuscaOp(selectedOp.lote || String(selectedOp.numeroSequencia));
    setOpId(String(selectedOp.id));
    setPecaId("");
    setProcesso("");
    setDropdownOpen(false);

    const soldadorAlocado = selectedOp.apontamentos?.[0]?.soldador;
    if (soldadorAlocado) {
      setUsuario(soldadorAlocado);
      setUsuarioFixo(true);
    } else {
      setUsuario("");
      setUsuarioFixo(false);
    }
  };

  if (operadores.length === 0) {
    return (
      <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
        Cadastre funcionários ativos em Configurações para lançar produção neste setor.
      </p>
    );
  }

  return (
    <form
      ref={formRef}
      action={handleAction}
      className="flex flex-col gap-4 rounded-lg border border-[#2d3449] bg-[#131b2e] px-5 py-4"
    >
      <input type="hidden" name="setorId" value={setorId} />
      {usuarioFixo && <input type="hidden" name="usuario" value={usuario} />}
      <input type="hidden" name="opId" value={opId} />

      <div>
        <h2 className="font-mono text-[11px] font-bold uppercase tracking-[0.1em] text-[#dae2fd]">
          Lançar produção · {setorNome}
        </h2>
        <p className="mt-1 text-xs text-slate-500">Busque pela OP e lance a quantidade efetivamente feita.</p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        {/* BUSCA DE OP (Combobox Customizado) */}
        <div className="relative">
          <input
            type="text"
            required={!opId}
            value={buscaOp}
            onChange={(e) => {
              setBuscaOp(e.target.value);
              setOpId("");
              setDropdownOpen(true);
              setUsuario("");
              setUsuarioFixo(false);
            }}
            onFocus={() => setDropdownOpen(true)}
            onBlur={() => setTimeout(() => setDropdownOpen(false), 200)}
            placeholder="Lote ou OP..."
            className="w-40 rounded border border-[#3d494c] bg-[#060e20] px-3 py-2 text-sm text-[#dae2fd] placeholder-slate-600 focus:border-[#4cd7f6] focus:outline-none"
          />
          {dropdownOpen && searchResults.length > 0 && (
            <ul className="absolute z-10 mt-1 w-64 rounded-md border border-[#3d494c] bg-[#0f172a] shadow-xl">
              {searchResults.map((op) => (
                <li
                  key={op.id}
                  onMouseDown={() => handleSelectOp(op)}
                  className="cursor-pointer border-b border-white/5 px-3 py-2 last:border-0 hover:bg-[#1e293b]"
                >
                  <div className="text-[11px] font-bold text-slate-100">
                    Lote {op.lote ?? "S/L"} · OP {op.numeroSequencia}
                  </div>
                  <div className="text-[10px] text-slate-400">{op.modelo.codigo}</div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* DETALHES DA OP SELECIONADA */}
        {opSelecionada && (
          <div className="flex h-9 items-center gap-3 rounded border border-emerald-500/30 bg-emerald-500/10 px-3">
            <div className="text-xs text-emerald-200">
              <span className="font-semibold text-emerald-400">Modelo:</span> {opSelecionada.modelo.codigo}
            </div>
            {usuarioFixo && usuario && (
              <div className="border-l border-emerald-500/30 pl-3 text-xs text-emerald-200">
                <span className="font-semibold text-emerald-400">Soldador:</span> {usuario}
              </div>
            )}
          </div>
        )}

        {/* OPERADOR (Apenas se não for fixo) */}
        {!usuarioFixo && (
          <select 
            name="usuario"
            required 
            value={usuario}
            onChange={(e) => setUsuario(e.target.value)}
            className="rounded border border-[#3d494c] bg-[#060e20] px-3 py-2 text-sm text-[#dae2fd] focus:border-[#4cd7f6] focus:outline-none"
          >
            <option value="" disabled>Operador...</option>
            {operadores.map((operador) => (
              <option key={operador.id} value={operador.nome}>{operador.nome}</option>
            ))}
          </select>
        )}

        {exigePeca && (
          <select
            name="pecaId"
            required
            value={pecaId}
            onChange={(event) => {
              setPecaId(event.target.value);
              setProcesso("");
            }}
            className="rounded border border-[#3d494c] bg-[#060e20] px-3 py-2 text-sm text-[#dae2fd] focus:border-[#4cd7f6] focus:outline-none"
          >
            <option value="" disabled>Peça...</option>
            {opSelecionada?.modelo.pecas.map((item) => (
              <option key={item.pecaId} value={item.pecaId}>{item.peca.codigo} · {item.peca.nome}</option>
            ))}
          </select>
        )}

        {exigePeca && pecaId && (
          <select
            name="processo"
            required
            value={processo}
            onChange={(event) => setProcesso(event.target.value)}
            className="rounded border border-[#3d494c] bg-[#060e20] px-3 py-2 text-sm text-[#dae2fd] focus:border-[#4cd7f6] focus:outline-none"
          >
            <option value="" disabled>Processo...</option>
            {processos.map((item) => (
              <option key={item} value={item}>
                {PROCESSO_LABEL[item as Processo]}
              </option>
            ))}
          </select>
        )}

        <input
          name="quantidadeBoa"
          type="number"
          min={1}
          step={1}
          required
          placeholder="Quantidade"
          className="w-28 rounded border border-[#3d494c] bg-[#060e20] px-3 py-2 text-sm text-[#dae2fd] placeholder-slate-600 focus:border-[#4cd7f6] focus:outline-none"
        />

        <SubmitButton pendingText="Lançando..." className="h-9 bg-[#0ea5c9] px-4 font-bold text-white hover:bg-[#0891b2]">
          Lançar
        </SubmitButton>
      </div>

      {erro && <p role="alert" className="text-sm font-medium text-red-400">{erro}</p>}
      {sucesso && <p role="status" className="text-sm font-medium text-emerald-400">{sucesso}</p>}
    </form>
  );
}
