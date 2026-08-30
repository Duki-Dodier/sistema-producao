import { prisma } from "@/lib/prisma";
import { buscarOperadorLogado } from "@/lib/auth-operador";

export type AlteracaoInput = {
  entidade: "MODELO" | "BOM" | "ROTEIRO" | "ESTOQUE" | "OP" | "NEST" | "FUNCIONARIO" | string;
  entidadeId?: number | null;
  acao: "CRIADO" | "ATUALIZADO" | "EXCLUIDO" | "MOVIMENTADO" | string;
  descricao: string;
  usuario?: string;
  dadosAntes?: unknown;
  dadosDepois?: unknown;
};

/** Registra a alteração sem interromper a operação principal se o log falhar. */
export async function registrarAlteracao(input: AlteracaoInput) {
  try {
    const usuario = input.usuario ?? (await buscarOperadorLogado())?.nome ?? "sistema";
    await prisma.historicoAlteracao.create({
      data: {
        entidade: input.entidade,
        entidadeId: input.entidadeId ?? null,
        acao: input.acao,
        descricao: input.descricao,
        usuario,
        dadosAntes: input.dadosAntes === undefined ? null : JSON.stringify(input.dadosAntes),
        dadosDepois: input.dadosDepois === undefined ? null : JSON.stringify(input.dadosDepois),
      },
    });
  } catch {
    // Auditoria nunca deve impedir um apontamento/cadastro válido.
  }
}
