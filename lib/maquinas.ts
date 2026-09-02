export function rotuloMaquina(codigo: string, nome: string) {
  return codigo.trim().toLocaleUpperCase("pt-BR") === nome.trim().toLocaleUpperCase("pt-BR")
    ? codigo
    : `${codigo} · ${nome}`;
}
