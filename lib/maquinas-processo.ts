type MaquinaComIdentificacao = {
  codigo: string;
  nome: string;
};

function normalizar(valor: string) {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLocaleUpperCase("pt-BR");
}

function grupoDaMaquinaTubo(maquina: MaquinaComIdentificacao) {
  const identificacao = normalizar(`${maquina.codigo} ${maquina.nome}`);

  if (identificacao.includes("SERRA")) return "SERRA";
  if (identificacao.includes("DOBRA")) return "DOBRA";
  if (identificacao.includes("CORTE")) return "CORTE";
  return null;
}

/**
 * No setor TUBO, cada etapa deve usar somente o grupo correto de máquinas.
 * AMASSAR compartilha as mesmas máquinas da DOBRA.
 */
export function maquinaCompativelComProcesso(
  setorNome: string,
  processo: string | null | undefined,
  maquina: MaquinaComIdentificacao,
) {
  if (normalizar(setorNome) !== "TUBO") return true;

  const processoNormalizado = normalizar(processo ?? "");
  const grupoEsperado = processoNormalizado === "CORTE"
    ? "CORTE"
    : processoNormalizado === "DOBRA" || processoNormalizado === "AMASSAR"
      ? "DOBRA"
      : processoNormalizado === "CORTE_GRAU"
        ? "SERRA"
        : null;

  return grupoEsperado === null || grupoDaMaquinaTubo(maquina) === grupoEsperado;
}

export function filtrarMaquinasPorProcesso<T extends MaquinaComIdentificacao>(
  setorNome: string,
  processo: string | null | undefined,
  maquinas: T[],
) {
  return maquinas.filter((maquina) => maquinaCompativelComProcesso(setorNome, processo, maquina));
}
