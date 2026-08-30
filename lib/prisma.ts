import { PrismaClient } from "@/app/generated/prisma/client";
import { PrismaD1 } from "@prisma/adapter-d1";
import { AsyncLocalStorage } from "node:async_hooks";
import { env } from "cloudflare:workers";

/**
 * O D1 cria Promises vinculadas ao contexto da requisição do Worker. Um
 * PrismaClient global pode reutilizar o compilador WASM entre duas requisições
 * simultâneas e o runtime cancela a segunda como "cross-request promise".
 * Mantemos o cliente no contexto assíncrono da requisição e o descartamos ao
 * final dela, que é o ciclo recomendado para Workers.
 */
const armazenamentoPrisma = new AsyncLocalStorage<PrismaClient>();

function novoPrisma(db: ConstructorParameters<typeof PrismaD1>[0]) {
  return new PrismaClient({
    adapter: new PrismaD1(db),
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

/** Executa uma requisição com um PrismaClient isolado do restante do Worker. */
export async function comPrisma<T>(
  db: ConstructorParameters<typeof PrismaD1>[0],
  operacao: () => Promise<T>,
): Promise<T> {
  const cliente = novoPrisma(db);
  return armazenamentoPrisma.run(cliente, async () => {
    try {
      return await operacao();
    } finally {
      await cliente.$disconnect();
    }
  });
}

function clienteAtual() {
  const cliente = armazenamentoPrisma.getStore();
  if (cliente) return cliente;

  // Compatibilidade para chamadas em testes e ferramentas fora do handler do
  // Worker. As páginas em produção sempre passam por comPrisma.
  return novoPrisma(env.DB);
}

/**
 * Proxy compatível com a API do PrismaClient já usada pelo projeto. Cada
 * acesso resolve o cliente associado à requisição corrente, sem alterar as
 * páginas e ações existentes.
 */
export const prisma = new Proxy({} as PrismaClient, {
  get(_alvo, propriedade: string | symbol) {
    const cliente = clienteAtual();
    const valor = Reflect.get(cliente, propriedade, cliente);
    return typeof valor === "function" ? valor.bind(cliente) : valor;
  },
});
