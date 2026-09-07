import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/** Endpoint temporário protegido para limpar dados operacionais de teste. */
export async function POST(request: Request) {
  const tokenEsperado = process.env.RESET_OPS_TOKEN;
  if (!tokenEsperado || request.headers.get("x-reset-ops-token") !== tokenEsperado) {
    return Response.json({ error: "Não autorizado." }, { status: 401 });
  }

  const ops = await prisma.oP.findMany({ select: { id: true } });
  const opIds = ops.map((op) => op.id);
  if (opIds.length === 0) {
    return Response.json({ deleted: false, ops: 0, nests: 0 });
  }

  const itens = await prisma.nestItem.findMany({
    where: { opId: { in: opIds } },
    select: { nestId: true },
  });
  const nestIds = [...new Set(itens.map((item) => item.nestId))];
  const itensDosNests = nestIds.length
    ? await prisma.nestItem.findMany({
        where: { nestId: { in: nestIds } },
        select: { nestId: true, opId: true },
      })
    : [];
  const nestsSemOutrasOps = nestIds.filter((nestId) =>
    itensDosNests
      .filter((item) => item.nestId === nestId)
      .every((item) => opIds.includes(item.opId)),
  );

  const operacoes = [
    prisma.nestItem.deleteMany({ where: { opId: { in: opIds } } }),
    ...(nestsSemOutrasOps.length
      ? [prisma.nestCorte.deleteMany({ where: { id: { in: nestsSemOutrasOps } } })]
      : []),
    prisma.oP.deleteMany({ where: { id: { in: opIds } } }),
  ];

  await prisma.$transaction(operacoes);
  return Response.json({ deleted: true, ops: opIds.length, nests: nestsSemOutrasOps.length });
}
