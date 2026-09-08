import { env } from "cloudflare:workers";
import { buscarOperadorLogado } from "@/lib/auth-operador";
import { prisma } from "@/lib/prisma";
import { planoCorteTuboInclude } from "@/lib/plano-corte-tubos-dados";
import { gerarPdfPlanoCorteTubos } from "@/lib/plano-corte-tubos-pdf";

export const runtime = "nodejs";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const usuario = await buscarOperadorLogado();
  if (!usuario) return new Response("Não autorizado", { status: 401 });
  if (!usuario.administrador && usuario.papel !== "PCP") return new Response("Acesso permitido somente ao PCP.", { status: 403 });
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id < 1) return new Response("Plano inválido.", { status: 400 });
  const plano = await prisma.planoCorteTubo.findUnique({ where: { id }, include: planoCorteTuboInclude });
  if (!plano) return new Response("Plano não encontrado.", { status: 404 });

  let logo: Uint8Array | undefined;
  try {
    const resposta = await env.ASSETS.fetch(new Request(new URL("/uploads/logo/logoBrucke.png", request.url)));
    if (resposta.ok) logo = new Uint8Array(await resposta.arrayBuffer());
  } catch { /* Marca textual usada como contingência. */ }

  const pdf = gerarPdfPlanoCorteTubos(plano, logo);
  return new Response(pdf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${plano.codigo.toLowerCase()}-plano-corte-tubos.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
