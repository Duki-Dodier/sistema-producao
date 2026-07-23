import { PrismaClient } from "@/app/generated/prisma/client";

// Singleton do Prisma Client.
// Em desenvolvimento o Next recarrega os módulos a cada alteração; sem esse
// cache global, cada reload abriria uma nova conexão até estourar o limite.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
