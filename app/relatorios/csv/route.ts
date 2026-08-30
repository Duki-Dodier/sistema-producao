import { buscarOperadorLogado } from "@/lib/auth-operador";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

function dataDoPeriodo(valor: string, fimDoDia = false) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) return null;
  const data = new Date(`${valor}T${fimDoDia ? "23:59:59.999" : "00:00:00.000"}-03:00`);
  return Number.isNaN(data.getTime()) ? null : data;
}

function csv(valor: unknown) {
  return `"${String(valor ?? "").replace(/"/g, '""')}"`;
}

export async function GET(request: Request) {
  if (!(await buscarOperadorLogado())) return new Response("Não autorizado", { status: 401 });
  const url = new URL(request.url);
  const produto = (url.searchParams.get("produto") ?? "").trim();
  const operador = (url.searchParams.get("operador") ?? "").trim();
  const statusParam = (url.searchParams.get("status") ?? "").trim();
  const status = ["ABERTA", "CONCLUIDA", "CANCELADA"].includes(statusParam) ? statusParam : "";
  const inicio = dataDoPeriodo((url.searchParams.get("inicio") ?? "").trim());
  const fim = dataDoPeriodo((url.searchParams.get("fim") ?? "").trim(), true);
  if (!produto && !operador) return new Response("Selecione um produto ou operador.", { status: 400 });
  if (inicio && fim && inicio > fim) return new Response("Período inválido.", { status: 400 });
  const opRelacao = { ...(status ? { status } : {}), ...(produto ? { modelo: { codigo: produto } } : {}) };
  const registros = await prisma.apontamento.findMany({
    where: {
      ...(Object.keys(opRelacao).length ? { op: opRelacao } : {}),
      ...(operador ? { usuario: operador } : {}),
      ...(inicio || fim ? { dataHora: { ...(inicio ? { gte: inicio } : {}), ...(fim ? { lte: fim } : {}) } } : {}),
    },
    orderBy: { dataHora: "desc" },
    take: 10000,
    select: { dataHora: true, op: { select: { numeroSequencia: true, lote: true, modelo: { select: { codigo: true } } } }, peca: { select: { codigo: true, nome: true } }, setor: { select: { nome: true } }, processo: true, usuario: true, maquina: { select: { codigo: true } }, quantidadeBoa: true, quantidadeRefugo: true, tempoSegundos: true },
  });
  const linhas = [
    ["Data", "OP", "Lote", "Modelo", "Peça", "Descrição peça", "Setor", "Processo", "Operador", "Máquina", "Quantidade boa", "Refugo", "Tempo (s)"],
    ...registros.map((item) => [item.dataHora.toLocaleString("pt-BR"), item.op.numeroSequencia, item.op.lote, item.op.modelo.codigo, item.peca?.codigo, item.peca?.nome, item.setor.nome, item.processo, item.usuario, item.maquina?.codigo, item.quantidadeBoa, item.quantidadeRefugo, item.tempoSegundos]),
  ];
  const conteudo = "\uFEFF" + linhas.map((linha) => linha.map(csv).join(";")).join("\r\n");
  return new Response(conteudo, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="relatorio-producao-${new Date().toISOString().slice(0, 10)}.csv"` } });
}
