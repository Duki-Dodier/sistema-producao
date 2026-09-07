import { env } from "cloudflare:workers";
import { buscarOperadorLogado } from "@/lib/auth-operador";
import { carregarRelatorioPlasma, periodoRelatorioPlasma } from "@/lib/plasma-relatorio";
import { gerarPdfRelatorioPlasma } from "@/lib/plasma-relatorio-pdf";

export const runtime = "nodejs";

function nomeArquivo(valor: string) {
  return valor.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase();
}

export async function GET(request: Request) {
  if (!(await buscarOperadorLogado())) return new Response("Não autorizado", { status: 401 });

  const url = new URL(request.url);
  const filtros = {
    busca: (url.searchParams.get("q") ?? "").trim(),
    dataInicio: (url.searchParams.get("dataInicio") ?? "").trim(),
    dataFim: (url.searchParams.get("dataFim") ?? "").trim(),
    maquina: (url.searchParams.get("maquina") ?? "").trim(),
    operador: (url.searchParams.get("operador") ?? "").trim(),
    status: (url.searchParams.get("status") ?? "").trim(),
    tipo: (url.searchParams.get("tipo") ?? "").trim(),
  };

  const inicio = filtros.dataInicio ? periodoRelatorioPlasma(filtros.dataInicio) : null;
  const fim = filtros.dataFim ? periodoRelatorioPlasma(filtros.dataFim, true) : null;
  if ((filtros.dataInicio && !inicio) || (filtros.dataFim && !fim)) return new Response("Período inválido.", { status: 400 });
  if (inicio && fim && inicio > fim) return new Response("A data inicial não pode ser posterior à data final.", { status: 400 });

  const dados = await carregarRelatorioPlasma(filtros);
  let logo: Uint8Array | undefined;
  try {
    const resposta = await env.ASSETS.fetch(new Request(new URL("/uploads/logo/logoBrucke.png", request.url)));
    if (resposta.ok) logo = new Uint8Array(await resposta.arrayBuffer());
  } catch { /* O cabeçalho usa a marca textual como contingência. */ }

  const pdf = gerarPdfRelatorioPlasma(dados, filtros, logo);
  const data = new Date().toISOString().slice(0, 10);
  return new Response(pdf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="relatorio-plasma-${nomeArquivo(data)}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
