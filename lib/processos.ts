import { normalizarNomeSetor } from "@/lib/setores";

export const PROCESSOS = [
  "CORTE",
  "BATIDA",
  "FURACAO",
  "DOBRA",
  "AMASSAR",
  "CORTE_GRAU",
  "LIXAR",
  "SOLDAGEM",
  "AGRUPAR",
] as const;
export type Processo = (typeof PROCESSOS)[number];

export const PROCESSO_LABEL: Record<Processo, string> = {
  CORTE: "Corte",
  BATIDA: "Batida",
  FURACAO: "Furação",
  DOBRA: "Dobra",
  AMASSAR: "Amassar",
  CORTE_GRAU: "Corte em grau",
  LIXAR: "Lixar",
  SOLDAGEM: "Soldar",
  AGRUPAR: "Agrupar",
};

type PecaComRoteiro = {
  processos?: string | null;
  tipoMaterial?: string | null;
  setor?: { nome: string } | null;
};

export function processosDaPeca(peca: PecaComRoteiro): Processo[] {
  const configurados = (peca.processos ?? "")
    .split(",")
    .map((item) => item.trim() as Processo)
    .filter((item): item is Processo => PROCESSOS.includes(item));
  if (configurados.length > 0) return configurados;

  const setor = normalizarNomeSetor(peca.setor?.nome ?? "");
  const material = peca.tipoMaterial ?? "";
  if (setor === "PLASMA CHAPA" || setor === "PLASMA TUBO") return ["CORTE"];
  if (setor === "TUBO" || material === "TUBO") {
    return ["CORTE"];
  }
  if (setor === "PONTEIRA") return ["CORTE", "BATIDA", "LIXAR", "SOLDAGEM"];
  if (material === "BARRA_CHATA") return ["CORTE", "FURACAO", "DOBRA"];
  return ["CORTE", "FURACAO", "DOBRA"];
}

export function processosDoForm(formData: FormData): string | null {
  const valores = formData.getAll("processos").map(String);
  const selecionados = PROCESSOS.filter((processo) => valores.includes(processo));
  return selecionados.length > 0 ? selecionados.join(",") : null;
}
