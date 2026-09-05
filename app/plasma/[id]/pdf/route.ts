import { env } from "cloudflare:workers";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { buscarOperadorLogado } from "@/lib/auth-operador";
import { prisma } from "@/lib/prisma";
import { rotuloMaquina } from "@/lib/maquinas";
import { boasConferidas, perdasEfetivas } from "@/lib/plasma-regras";
import { gerarPdfNest } from "@/lib/nest-pdf";

export const runtime = "nodejs";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await buscarOperadorLogado())) return new Response("Não autorizado", { status: 401 });
  const { id: bruto } = await params;
  const id = Number(bruto);
  if (!Number.isInteger(id)) notFound();
  const nest = await prisma.nestCorte.findUnique({
    where: { id },
    include: {
      setor: { select: { nome: true } },
      maquina: { select: { codigo: true, nome: true } },
      programador: { select: { nome: true } },
      itens: { orderBy: { id: "asc" }, include: {
        peca: { select: { codigo: true, nome: true, medida: true } },
        op: { select: { id: true, lote: true, modelo: { select: { codigo: true } } } },
        lancamentos: true,
      } },
    },
  });
  if (!nest) notFound();

  const origem = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || new URL(request.url).origin;
  const qrDataUrl = await QRCode.toDataURL(`${origem}/plasma/${nest.id}?origem=qrcode`, {
    errorCorrectionLevel: "H", margin: 4, width: 640,
    color: { dark: "#0f1d34", light: "#ffffff" },
  });
  let logo: Uint8Array | undefined;
  try {
    const resposta = await env.ASSETS.fetch(new Request(new URL("/uploads/logo/logoBrucke.png", request.url)));
    if (resposta.ok) logo = new Uint8Array(await resposta.arrayBuffer());
  } catch { /* A marca textual permanece como contingência. */ }

  const pdf = gerarPdfNest({
    codigo: nest.codigo, status: nest.status, setor: nest.setor.nome,
    maquina: rotuloMaquina(nest.maquina.codigo, nest.maquina.nome), programador: nest.programador.nome,
    material: nest.material, espessuraMm: nest.espessuraMm, larguraChapaMm: nest.larguraChapaMm,
    alturaChapaMm: nest.alturaChapaMm, quantidadeChapas: nest.quantidadeChapas,
    aproveitamentoPct: nest.aproveitamentoPct, tempoCorteSegundos: nest.tempoCorteSegundos,
    numeroPiercings: nest.numeroPiercings, comprimentoCorteMm: nest.comprimentoCorteMm,
    comprimentoRapidoMm: nest.comprimentoRapidoMm, pesoChapaKg: nest.pesoChapaKg,
    nomeArquivo: nest.nomeArquivo, observacao: nest.observacao, criadoEm: nest.createdAt,
    itens: nest.itens.map(item => ({
      codigo: item.peca.codigo, nome: item.peca.nome, medida: item.peca.medida,
      op: `OP ${item.op.lote ?? `#${item.op.id}`}`, modelo: item.op.modelo.codigo,
      planejado: item.quantidadePlanejada,
      declarado: item.lancamentos.reduce((s, l) => s + l.quantidadeBoa, 0),
      liberado: item.lancamentos.reduce((s, l) => s + boasConferidas(l), 0),
      perdas: item.lancamentos.reduce((s, l) => s + perdasEfetivas(l), 0),
    })),
  }, qrDataUrl, logo);
  const nome = nest.codigo.replace(/[^a-zA-Z0-9_-]/g, "-");
  return new Response(pdf, { headers: {
    "Content-Type": "application/pdf",
    "Content-Disposition": `inline; filename="ordem-corte-${nome}.pdf"`,
    "Cache-Control": "no-store",
  } });
}
