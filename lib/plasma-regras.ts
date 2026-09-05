import { ehSetor } from "@/lib/setores";

/** O registro do operador não é saldo liberado. Registros legados já apontados
 * continuam válidos; a implantação não reabre nem reescreve o histórico. */
export type RegistroCorte = {
  quantidadeBoa: number;
  quantidadeRefugo: number;
  apontamentoId: number | null;
  quantidadeConferidaBoa?: number | null;
  quantidadeConferidaRefugo?: number | null;
};

export function boasConferidas(registro: RegistroCorte) {
  return registro.apontamentoId === null ? 0 : registro.quantidadeConferidaBoa ?? registro.quantidadeBoa;
}

export function perdasEfetivas(registro: RegistroCorte) {
  return registro.quantidadeConferidaRefugo ?? registro.quantidadeRefugo;
}

export function saldoProgramacao(necessaria: number, oficial: number, itens: {
  quantidadePlanejada: number; status: string; lancamentos: RegistroCorte[];
}[]) {
  let aguardando = 0;
  let reservado = 0;
  let perdas = 0;
  for (const item of itens) {
    let registrado = 0;
    for (const registro of item.lancamentos) {
      registrado += registro.quantidadeBoa + registro.quantidadeRefugo;
      perdas += perdasEfetivas(registro);
      if (registro.apontamentoId === null) aguardando += registro.quantidadeBoa;
    }
    if (["PROGRAMADO", "EM_CORTE", "PAUSADO"].includes(item.status)) {
      reservado += Math.max(0, item.quantidadePlanejada - registrado);
    }
  }
  const disponivel = Math.max(0, necessaria - oficial - aguardando - reservado);
  return { necessaria, oficial, aguardando, reservado, disponivel, perdas, reposicao: Math.min(perdas, disponivel) };
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

export function podeConferirPlasma(usuario: { papel: string; setorNome: string } | null) {
  return Boolean(usuario && usuario.papel === "CONFERENTE" && ehSetor(usuario.setorNome, "Plasma Chapa"));
}
