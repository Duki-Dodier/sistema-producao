import { env } from "cloudflare:workers";
import { buscarOperadorLogado } from "@/lib/auth-operador";
import { prisma } from "@/lib/prisma";
import { ehSetor } from "@/lib/setores";
import { planoTuboInclude } from "@/lib/tubo-plano-corte-dados";
import { gerarPdfPlanoCorteTubo } from "@/lib/tubo-plano-corte-pdf";

export const runtime = "nodejs";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const usuario = await buscarOperadorLogado();
  if (!usuario) return new Response("Não autorizado", { status: 401 });
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id < 1) return new Response("Plano inválido", { status: 400 });
  const plano = await prisma.planoCorteTubo.findUnique({ where: { id }, include: planoTuboInclude });
  if (!plano || !ehSetor(plano.setor.nome, "Tubo")) return new Response("Plano não encontrado", { status: 404 });
  if (!usuario.administrador && usuario.papel !== "PCP" && usuario.setorId !== plano.setorId) return new Response("Acesso negado", { status: 403 });
  let logo: Uint8Array | undefined;
  try {
    const resposta = await env.ASSETS.fetch(new Request(new URL("/uploads/logo/logoBrucke.png", request.url)));
    if (resposta.ok) logo = new Uint8Array(await resposta.arrayBuffer());
  } catch { /* O PDF mantém a marca textual como contingência. */ }
  const pdf = gerarPdfPlanoCorteTubo(plano, logo);
  return new Response(pdf, { headers: {
    "Content-Type": "application/pdf",
    "Content-Disposition": `attachment; filename="plano-corte-tubo-${plano.codigo.toLowerCase()}.pdf"`,
    "Cache-Control": "no-store",
  } });
}
