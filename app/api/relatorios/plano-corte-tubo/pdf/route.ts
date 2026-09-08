import { buscarDemandasTubo } from "@/lib/demanda-tubos-ops";
import { otimizarCorteTubos } from "@/lib/otimizador-corte-tubo";
import { gerarPdfOtimizadorTubos } from "@/lib/otimizador-corte-tubo-pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    const opsParam = searchParams.get("ops");
    const opsIds = opsParam
      ? opsParam
          .split(",")
          .map((id) => Number(id.trim()))
          .filter((id) => Number.isInteger(id) && id > 0)
      : undefined;

    const comprimentoBarraMm = Number(searchParams.get("barra")) || 6000;
    const perdaCorteMm = Number(searchParams.get("kerf")) || 3;
    const refileInicialMm = Number(searchParams.get("refile")) || 10;

    const { demandas } = await buscarDemandasTubo(opsIds);

    const resultado = otimizarCorteTubos(demandas, {
      comprimentoBarraMm,
      perdaCorteMm,
      refileInicialMm,
    });

    const pdfBuffer = gerarPdfOtimizadorTubos(resultado);

    return new Response(pdfBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'inline; filename="plano-corte-tubos.pdf"',
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Erro ao gerar PDF do plano de corte:", error);
    return new Response("Erro ao gerar PDF", { status: 500 });
  }
}
