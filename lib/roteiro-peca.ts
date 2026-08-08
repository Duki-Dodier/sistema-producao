import { processosDaPeca, type Processo } from "@/lib/processos";
import { normalizarNomeSetor, setorComponentePorMaterial } from "@/lib/setores";

export type EtapaRoteiroPeca = {
  id?: number | null;
  setorId: number;
  processo: Processo;
  ordem: number;
};

type SetorBasico = { id: number; nome: string };
type PecaBasica = {
  setorId: number;
  nome?: string | null;
  tipoMaterial?: string | null;
  medidaA?: number | null;
  espessuraMm?: number | null;
  processos?: string | null;
  setor?: { nome: string } | null;
};

function setorPorNome(setores: SetorBasico[], nome: string) {
  const alvo = normalizarNomeSetor(nome);
  return setores.find((setor) => {
    const atual = normalizarNomeSetor(setor.nome);
    return atual === alvo || atual.startsWith(alvo) || alvo.startsWith(atual);
  });
}

function normalizarDescricao(valor: string | null | undefined) {
  return (valor ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleUpperCase("pt-BR");
}

export function roteiroPadraoDaPeca(
  peca: PecaBasica,
  setores: SetorBasico[],
): EtapaRoteiroPeca[] {
  const agrupamento = setorPorNome(setores, "Agrupamento");
  const componente = setorPorNome(setores, "Componente Barra Chata e Cantoneira");
  const reforco = setorPorNome(setores, "Componente Reforço");
  const acessorios = setorPorNome(setores, "Acessórios");
  const plasmaTubo = setorPorNome(setores, "Plasma Tubo");
  const ponteira = setorPorNome(setores, "Ponteira");
  const principal = setores.find((setor) => setor.id === peca.setorId);
  const setorComponente = setorPorNome(setores, setorComponentePorMaterial(peca.tipoMaterial));
  const etapas: Omit<EtapaRoteiroPeca, "ordem">[] = [];
  const adicionar = (setorId: number | undefined, processo: Processo) => {
    if (setorId) etapas.push({ setorId, processo });
  };

  const reforco75x3 =
    peca.tipoMaterial === "REFORCO" &&
    Math.abs((peca.medidaA ?? 0) - 75) < 0.01 &&
    Math.abs((peca.espessuraMm ?? 0) - 3) < 0.01;
  const nomePeca = normalizarDescricao(peca.nome);
  const ponteiraRemovivel =
    peca.tipoMaterial === "PONTEIRA" &&
    (nomePeca.includes("PONTEIRA REM") || nomePeca.includes("CABECA REMOVIVEL"));
  const ponteiraFixa =
    peca.tipoMaterial === "PONTEIRA" &&
    (nomePeca.includes("PONTEIRA FIXA") ||
      Math.abs((peca.espessuraMm ?? 0) - 4.75) < 0.01);
  const anelPlasmaTubo =
    normalizarNomeSetor(principal?.nome ?? "") === "PLASMA TUBO" &&
    (peca.nome ?? "").toLocaleUpperCase("pt-BR").includes("ANEL");

  if (ponteiraRemovivel) {
    adicionar(plasmaTubo?.id, "CORTE");
    adicionar(ponteira?.id, "SOLDAGEM");
    adicionar(ponteira?.id, "LIXAR");
  } else if (ponteiraFixa) {
    adicionar(ponteira?.id, "CORTE");
    adicionar(ponteira?.id, "BATIDA");
    adicionar(ponteira?.id, "LIXAR");
    adicionar(ponteira?.id, "SOLDAGEM");
  } else if (reforco75x3) {
    adicionar(ponteira?.id, "CORTE");
    adicionar(reforco?.id ?? setorComponente?.id, "DOBRA");
  } else if (anelPlasmaTubo) {
    adicionar(principal?.id, "CORTE");
    adicionar(ponteira?.id, "LIXAR");
    adicionar(ponteira?.id, "SOLDAGEM");
  } else if (peca.tipoMaterial === "CANTONEIRA") {
    adicionar(componente?.id ?? setorComponente?.id ?? principal?.id, "CORTE");
    adicionar(ponteira?.id, "DOBRA");
  } else if (peca.tipoMaterial === "PLASMA") {
    adicionar(principal?.id, "CORTE");
    if (processosDaPeca(peca).includes("DOBRA")) {
      adicionar(componente?.id ?? acessorios?.id ?? setorComponente?.id, "DOBRA");
    }
  } else {
    for (const processo of processosDaPeca({ ...peca, setor: principal })) {
      adicionar(principal?.id, processo);
    }
  }

  adicionar(agrupamento?.id, "AGRUPAR");
  return etapas.map((etapa, indice) => ({ ...etapa, ordem: indice + 1 }));
}

export function etapasDoFormulario(formData: FormData): Omit<EtapaRoteiroPeca, "id">[] {
  const setores = formData.getAll("etapaSetorId").map(Number);
  const processos = formData.getAll("etapaProcesso").map(String);
  return setores
    .map((setorId, indice) => ({
      setorId,
      processo: processos[indice] as Processo,
      ordem: indice + 1,
    }))
    .filter((etapa) => Number.isInteger(etapa.setorId) && etapa.setorId > 0 && etapa.processo);
}
