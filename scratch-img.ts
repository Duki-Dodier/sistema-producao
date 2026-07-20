import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
(async () => {
  const pecas = await p.peca.findMany({ select: { codigo: true, imagemUrl: true } });
  const com = pecas.filter((x) => x.imagemUrl);
  console.log(`total=${pecas.length} comImagem=${com.length}`);
  console.log(com.map((x) => `${x.codigo}: ${x.imagemUrl}`).join("\n") || "(nenhuma peça tem imagem)");
  const modelos = await p.modelo.findMany({ select: { codigo: true, imagemUrl: true } });
  console.log("modelos com imagem:", modelos.filter((m) => m.imagemUrl).map((m) => m.codigo).join(", ") || "(nenhum)");
  await p.$disconnect();
})();
