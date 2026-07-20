export function normalizarNomeSetor(nome: string): string {
  return nome
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();
}

export function ehSetor(nome: string, esperado: string): boolean {
  return normalizarNomeSetor(nome) === normalizarNomeSetor(esperado);
}

export const SETORES_FINAIS = ["Agrupamento", "Solda", "Pintura", "Montagem"] as const;

export function ehSetorFinal(nome: string): boolean {
  return SETORES_FINAIS.some((setor) => ehSetor(nome, setor));
}
