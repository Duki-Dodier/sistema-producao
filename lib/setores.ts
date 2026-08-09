export function normalizarNomeSetor(nome: string): string {
  return nome
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();
}

export type GrupoSetor = "FABRICACAO" | "FLUXO_FINAL";

export type DefinicaoSetor = {
  nome: string;
  grupo: GrupoSetor;
  descricao: string;
};

/** Estrutura oficial do fluxo físico da fábrica. */
export const SETORES_PADRAO: readonly DefinicaoSetor[] = [
  {
    nome: "Tubo",
    grupo: "FABRICACAO",
    descricao: "Corte, dobra e preparação dos tubos.",
  },
  {
    nome: "Plasma Chapa",
    grupo: "FABRICACAO",
    descricao: "Corte e preparação das chapas no plasma.",
  },
  {
    nome: "Plasma Tubo",
    grupo: "FABRICACAO",
    descricao: "Corte e preparação de peças no plasma de tubo.",
  },
  {
    nome: "Componente Barra Chata e Cantoneira",
    grupo: "FABRICACAO",
    descricao: "Corte, furação e dobra de barras chatas e cantoneiras.",
  },
  {
    nome: "Componente Reforço",
    grupo: "FABRICACAO",
    descricao: "Preparação dos reforços do engate.",
  },
  {
    nome: "Ponteira",
    grupo: "FABRICACAO",
    descricao: "Preparação, acabamento e soldagem das ponteiras.",
  },
  {
    nome: "Acessórios",
    grupo: "FABRICACAO",
    descricao: "Preparação de acessórios e componentes complementares.",
  },
  {
    nome: "Agrupamento",
    grupo: "FLUXO_FINAL",
    descricao: "Confere, identifica e guarda as peças pré-prontas para a Solda.",
  },
  {
    nome: "Solda",
    grupo: "FLUXO_FINAL",
    descricao: "Monta o conjunto e realiza a soldagem.",
  },
  {
    nome: "Pintura",
    grupo: "FLUXO_FINAL",
    descricao: "Acabamento e pintura do conjunto soldado.",
  },
  {
    nome: "Montagem",
    grupo: "FLUXO_FINAL",
    descricao: "Montagem final e liberação do produto.",
  },
] as const;

export const SETORES_FABRICACAO = SETORES_PADRAO
  .filter((setor) => setor.grupo === "FABRICACAO")
  .map((setor) => setor.nome);

export function ehSetor(nome: string, esperado: string): boolean {
  return chaveSetor(nome) === chaveSetor(esperado);
}

const ALIASES_SETOR: Record<string, string> = {
  "COMPONENTES E ACESSORIOS": "COMPONENTE BARRA CHATA E CANTONEIRA",
  COMPONENTE: "COMPONENTE BARRA CHATA E CANTONEIRA",
};

function chaveSetor(nome: string) {
  const normalizado = normalizarNomeSetor(nome);
  return ALIASES_SETOR[normalizado] ?? normalizado;
}

export const SETORES_FINAIS = ["Agrupamento", "Solda", "Pintura", "Montagem"] as const;

export const SETORES_COMPONENTES = [
  "Componente Barra Chata e Cantoneira",
  "Componente Reforço",
  "Acessórios",
] as const;

export function definicaoSetor(nome: string): DefinicaoSetor | undefined {
  return SETORES_PADRAO.find((setor) => ehSetor(setor.nome, nome));
}

export function ehSetorFinal(nome: string): boolean {
  return SETORES_FINAIS.some((setor) => ehSetor(nome, setor));
}

export function ehSetorFabricacao(nome: string): boolean {
  return SETORES_FABRICACAO.some((setor) => ehSetor(nome, setor));
}

export function setorComponentePorMaterial(tipoMaterial?: string | null): string {
  if (tipoMaterial === "REFORCO") return "Componente Reforço";
  if (tipoMaterial === "BARRA_CHATA" || tipoMaterial === "CANTONEIRA") {
    return "Componente Barra Chata e Cantoneira";
  }
  return "Acessórios";
}
