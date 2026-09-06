import { ehSetor } from "@/lib/setores";

/** O registro do operador não é saldo liberado. Registros legados já apontados
 * continuam válidos; a implantação não reabre nem reescreve o histórico. */
export type RegistroCorte = {
  quantidadeBoa: number;
  quantidadeRefugo: number;
  apontamentoId: number | null;
  conferenteId?: number | null;
  quantidadeConferidaBoa?: number | null;
  quantidadeConferidaRefugo?: number | null;
};

export function boasConferidas(registro: RegistroCorte) {
  return registro.apontamentoId === null ? 0 : registro.quantidadeConferidaBoa ?? registro.quantidadeBoa;
}

export function perdasEfetivas(registro: RegistroCorte) {
  return registro.quantidadeConferidaRefugo ?? registro.quantidadeRefugo;
}

/** Separa a perda oficial entre o que o operador já declarou e a diferença
 * identificada pelo conferente no recebimento das peças. */
export function perdasOperador(registro: RegistroCorte) {
  return Math.min(registro.quantidadeRefugo, perdasEfetivas(registro));
}

export function perdasConferente(registro: RegistroCorte) {
  return Math.max(0, perdasEfetivas(registro) - registro.quantidadeRefugo);
}

export function saldoProgramacao(necessaria: number, oficial: number, itens: {
  quantidadePlanejada: number; status: string; lancamentos: RegistroCorte[];
}[]) {
  let aguardando = 0;
  let reservado = 0;
  let perdas = 0;
  let perdasOperadorTotal = 0;
  let perdasConferenteTotal = 0;
  let conferenteNotificou = false;
  for (const item of itens) {
    let registrado = 0;
    for (const registro of item.lancamentos) {
      registrado += registro.quantidadeBoa + registro.quantidadeRefugo;
      perdas += perdasEfetivas(registro);
      perdasOperadorTotal += perdasOperador(registro);
      perdasConferenteTotal += perdasConferente(registro);
      if (registro.conferenteId != null && perdasEfetivas(registro) > 0) conferenteNotificou = true;
      if (registro.apontamentoId === null) aguardando += registro.quantidadeBoa;
    }
    if (["PROGRAMADO", "EM_CORTE", "PAUSADO"].includes(item.status)) {
      reservado += Math.max(0, item.quantidadePlanejada - registrado);
    }
  }
  const disponivel = Math.max(0, necessaria - oficial - aguardando - reservado);
  const reposicao = Math.min(perdas, disponivel);
  const reposicaoOperador = Math.min(perdasOperadorTotal, reposicao);
  const reposicaoConferente = Math.min(perdasConferenteTotal, Math.max(0, reposicao - reposicaoOperador));
  return {
    necessaria,
    oficial,
    aguardando,
    reservado,
    disponivel,
    perdas,
    perdasOperador: perdasOperadorTotal,
    perdasConferente: perdasConferenteTotal,
    reposicao,
    reposicaoOperador,
    reposicaoConferente,
    conferenteNotificou,
  };
}

export function segundosEfetivos(eventos: { tipo: string; dataHora: Date | string }[], agora = Date.now()) {
  let inicio: number | null = null;
  let total = 0;
  for (const evento of [...eventos].sort((a, b) => +new Date(a.dataHora) - +new Date(b.dataHora))) {
    const instante = +new Date(evento.dataHora);
    if (["INICIO", "RETORNO"].includes(evento.tipo) && inicio === null) inicio = instante;
    if (["PAUSA", "FIM", "CANCELAMENTO"].includes(evento.tipo) && inicio !== null) {
      total += Math.max(0, instante - inicio);
      inicio = null;
    }
  }
  if (inicio !== null) total += Math.max(0, agora - inicio);
  return Math.floor(total / 1000);
}

export function podeConferirPlasma(usuario: { papel: string; setorNome: string; administrador?: boolean } | null) {
  return Boolean(usuario && (usuario.administrador || (usuario.papel === "CONFERENTE" && ehSetor(usuario.setorNome, "Plasma Chapa"))));
}
