import { buscarOperadorLogado } from "@/lib/auth-operador";
import { formatDate, formatDateTime } from "@/lib/format";
import { gerarPdfRelatorio } from "@/lib/pdf-relatorio";
import { prisma } from "@/lib/prisma";
import { ehSetor } from "@/lib/setores";

export const runtime = "nodejs";

function texto(valor: string | null, limite = 120) {
  return (valor ?? "").trim().slice(0, limite);
}

function periodoDoMes(valor: string) {
  const hoje = new Date();
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(valor)) {
    return { ano: hoje.getFullYear(), mes: hoje.getMonth() + 1 };
  }
  const [ano, mes] = valor.split("-").map(Number);
  return { ano, mes };
}

function dataSelecionada(valor: string, ano: number, mes: number) {
  if (!/^\d{4}-(0[1-9]|[12]\d|3[01])$/.test(valor)) return null;
  const [anoInformado, mesInformado, dia] = valor.split("-").map(Number);
  if (anoInformado !== ano || mesInformado !== mes) return null;
  const inicio = new Date(ano, mes - 1, dia);
  if (inicio.getFullYear() !== ano || inicio.getMonth() !== mes - 1 || inicio.getDate() !== dia) return null;
  return { inicio, fim: new Date(ano, mes - 1, dia + 1) };
}

function formatarDuracao(segundos: number) {
  if (segundos <= 0) return "-";
  const horas = Math.floor(segundos / 3600);
  const minutos = Math.floor((segundos % 3600) / 60);
  return horas > 0 ? `${horas}h ${String(minutos).padStart(2, "0")}min` : `${minutos}min`;
}

function nomeArquivo(valor: string) {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

export async function GET(request: Request) {
  if (!(await buscarOperadorLogado())) return new Response("Não autorizado", { status: 401 });

  const url = new URL(request.url);
  const setorId = Number(url.searchParams.get("setor"));
  if (!Number.isInteger(setorId) || setorId < 1) return new Response("Setor inválido.", { status: 400 });

  const setor = await prisma.setor.findUnique({ where: { id: setorId }, select: { id: true, nome: true } });
  if (!setor) return new Response("Setor não encontrado.", { status: 404 });

  const { ano, mes } = periodoDoMes(texto(url.searchParams.get("mes"), 7));
  const inicioMes = new Date(ano, mes - 1, 1);
  const fimMes = new Date(ano, mes, 1);
  const dataFiltro = texto(url.searchParams.get("data"), 10);
  const diaSelecionado = dataSelecionada(dataFiltro, ano, mes);
  if (dataFiltro && !diaSelecionado) return new Response("Data inválida para o mês selecionado.", { status: 400 });

  const busca = texto(url.searchParams.get("q"));
  const operador = texto(url.searchParams.get("operador"));
  const maquina = texto(url.searchParams.get("maquina"));
  const inicio = diaSelecionado?.inicio ?? inicioMes;
  const fim = diaSelecionado?.fim ?? fimMes;

  const apontamentos = await prisma.apontamento.findMany({
    where: {
      setorId: setor.id,
      dataHora: { gte: inicio, lt: fim },
      ...(ehSetor(setor.nome, "Solda") ? { soldador: null } : {}),
    },
    select: {
      id: true,
      dataHora: true,
      processo: true,
      usuario: true,
      quantidadeBoa: true,
      tempoSegundos: true,
      op: { select: { numeroSequencia: true, lote: true, modelo: { select: { codigo: true } } } },
      maquina: { select: { codigo: true } },
      peca: { select: { codigo: true, nome: true } },
    },
    orderBy: { dataHora: "asc" },
  });

  const termo = busca.toLocaleLowerCase("pt-BR");
  const registros = apontamentos.filter((registro) => {
    const conteudo = [registro.op.numeroSequencia, registro.op.lote, registro.op.modelo.codigo, registro.peca?.codigo, registro.peca?.nome, registro.usuario, registro.maquina?.codigo]
      .filter(Boolean)
      .join(" ")
      .toLocaleLowerCase("pt-BR");
    return (!termo || conteudo.includes(termo)) && (!operador || registro.usuario === operador) && (!maquina || registro.maquina?.codigo === maquina);
  });
  const totalPecas = registros.reduce((total, registro) => total + registro.quantidadeBoa, 0);
  const tempoTotal = registros.reduce((total, registro) => total + (registro.tempoSegundos ?? 0), 0);
  const mesLabel = inicioMes.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  const periodo = diaSelecionado ? formatDate(diaSelecionado.inicio) : mesLabel;
  const emitidoEm = formatDateTime(new Date());

  const pdf = gerarPdfRelatorio({
    titulo: "Registro por operador e máquina",
    subtitulo: setor.nome.toLocaleUpperCase("pt-BR"),
    periodo: `Período: ${periodo}`,
    orientacao: "paisagem",
    kpis: [
      { label: "Lançamentos", value: String(registros.length) },
      { label: "Peças apontadas", value: totalPecas.toLocaleString("pt-BR") },
      { label: "Tempo informado", value: formatarDuracao(tempoTotal) },
      { label: "Operadores", value: String(new Set(registros.map((registro) => registro.usuario)).size) },
    ],
    secoes: [
      {
        titulo: "Filtros e emissão",
        colunas: [
          { titulo: "Período", largura: 170 },
          { titulo: "Operador", largura: 180 },
          { titulo: "Máquina", largura: 150 },
          { titulo: "Busca", largura: 150 },
          { titulo: "Emitido em", largura: 116 },
        ],
        linhas: [[periodo, operador || "Todos os operadores", maquina || "Todas as máquinas", busca || "Sem busca", emitidoEm]],
        quebrarLinhas: true,
      },
      {
        titulo: `Lançamentos encontrados (${registros.length})`,
        colunas: [
          { titulo: "Data/hora", largura: 95 },
          { titulo: "OP / peça", largura: 210 },
          { titulo: "Processo", largura: 80 },
          { titulo: "Operador", largura: 130 },
          { titulo: "Máquina", largura: 70 },
          { titulo: "Tempo", largura: 75, alinhar: "right" },
          { titulo: "Peças", largura: 106, alinhar: "right" },
        ],
        linhas: registros.map((registro) => [
          formatDateTime(registro.dataHora),
          `OP ${registro.op.numeroSequencia} · ${registro.op.modelo.codigo} · ${registro.peca ? `${registro.peca.codigo} · ${registro.peca.nome}` : "Produção do setor"}${registro.op.lote ? ` · lote ${registro.op.lote}` : ""}`,
          registro.processo ?? "Produção geral",
          registro.usuario,
          registro.maquina?.codigo ?? "-",
          formatarDuracao(registro.tempoSegundos ?? 0),
          registro.quantidadeBoa.toLocaleString("pt-BR"),
        ]),
        quebrarLinhas: true,
      },
    ],
  });

  const referenciaArquivo = dataFiltro || `${ano}-${String(mes).padStart(2, "0")}`;
  const arquivo = `registro-operador-maquina-${nomeArquivo(setor.nome) || "setor"}-${referenciaArquivo}.pdf`;
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${arquivo}"`,
      "Cache-Control": "no-store",
    },
  });
}
