export const TAMANHOS_PONTEIRA = [
  { chave: "PEQUENA", nome: "Pequena", espessuraChapa: "12 mm" },
  { chave: "MEDIA", nome: "Média", espessuraChapa: "12 mm" },
  { chave: "GRANDE", nome: "Grande", espessuraChapa: "16 mm" },
] as const;

export type TamanhoPonteira = (typeof TAMANHOS_PONTEIRA)[number]["chave"];

const TAMANHOS_VALIDOS = new Set<string>(TAMANHOS_PONTEIRA.map((tamanho) => tamanho.chave));

/** SKUs dos conjuntos de ponteira macho.
 * Entram na BOM das OPs PONTEIRA_MACHO. Nos engates removíveis, o tubo fêmea
 * "Ponteira Rem." continua na BOM e estes componentes são controlados à parte
 * na página Ponteiras Macho.
 */
export const COMPONENTES_PONTEIRA = {
  tuboPequenaMedia: { codigo: "PON-TB-PM", nome: "Tubo de ponteira pequena/média", setor: "Plasma Tubo" },
  tuboGrande: { codigo: "PON-TB-G", nome: "Tubo de ponteira grande", setor: "Plasma Tubo" },
  chapa12: { codigo: "PON-CH-12", nome: "Chapa de ponteira 12 mm", setor: "Plasma Chapa" },
  chapa16: { codigo: "PON-CH-16", nome: "Chapa de ponteira 16 mm", setor: "Plasma Chapa" },
} as const;

export function componentesParaTamanho(tamanho: TamanhoPonteira) {
  if (tamanho === "GRANDE") {
    return {
      tubo: COMPONENTES_PONTEIRA.tuboGrande,
      chapa: COMPONENTES_PONTEIRA.chapa16,
    };
  }
  return {
    tubo: COMPONENTES_PONTEIRA.tuboPequenaMedia,
    chapa: COMPONENTES_PONTEIRA.chapa12,
  };
}

export function normalizarTamanhoPonteira(valor: string | null | undefined): TamanhoPonteira | null {
  const normalizado = (valor ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLocaleUpperCase("pt-BR");
  return TAMANHOS_VALIDOS.has(normalizado) ? (normalizado as TamanhoPonteira) : null;
}
