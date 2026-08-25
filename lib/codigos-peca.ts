import { SUFIXO_MATERIAL } from "@/lib/labels";

export function proximoCodigoPeca(
  modeloCodigo: string,
  tipoMaterial: string,
  codigosExistentes: string[],
) {
  const sufixo = SUFIXO_MATERIAL[tipoMaterial] ?? "OT";
  const base = `${modeloCodigo}-${sufixo}`;
  const usados = new Set(codigosExistentes);
  const sempreNumerado = tipoMaterial === "PLASMA" || tipoMaterial === "CHAPA";

  if (!sempreNumerado && !usados.has(base)) return base;

  let numero = 1;
  while (usados.has(`${base}${numero}`)) numero += 1;
  return `${base}${numero}`;
}
