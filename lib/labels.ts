export const TIPO_LABEL: Record<string, string> = {
  FIXO: "Fixo",
  REMOVIVEL: "Removível",
};

export const CURVA_VARIANT = {
  A: "danger",
  B: "warning",
  C: "info",
} as const;

export const TIPO_MATERIAL_LABEL: Record<string, string> = {
  TUBO: "Tubo",
  BARRA_CHATA: "Barra Chata",
  CHAPA: "Chapa",
  CANTONEIRA: "Cantoneira",
  REFORCO: "Reforço",
  PONTEIRA: "Ponteira",
  PLASMA: "Plasma",
  OUTRO: "Outro",
};

export const SUFIXO_MATERIAL: Record<string, string> = {
  TUBO: "TB",
  BARRA_CHATA: "BC",
  CHAPA: "CH",
  CANTONEIRA: "CT",
  REFORCO: "RF",
  PONTEIRA: "PT",
  PLASMA: "PL",
  OUTRO: "OT",
};

export const STATUS_OP_LABEL: Record<string, string> = {
  ABERTA: "Aberta",
  CONCLUIDA: "Concluída",
  CANCELADA: "Cancelada",
};

export const STATUS_OP_VARIANT: Record<
  string,
  "neutral" | "info" | "success" | "warning" | "danger"
> = {
  ABERTA: "neutral",
  CONCLUIDA: "success",
  CANCELADA: "danger",
};
