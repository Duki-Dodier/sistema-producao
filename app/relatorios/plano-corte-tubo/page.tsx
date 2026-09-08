import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { buscarDemandasTubo } from "@/lib/demanda-tubos-ops";
import { OtimizadorTuboView } from "@/components/otimizador-tubo-view";
import { ArrowLeft, Scissors } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function PlanoCorteTuboRelatorioPage() {
  const { demandas, opsDisponiveis } = await buscarDemandasTubo();

  return (
    <div className="flex flex-col gap-6 p-3 sm:p-6 print:p-0 print:gap-0">
      <div className="print:hidden">
        <PageHeader
          title="Otimizador de Corte de Tubos · Barras de 6 Metros"
          subtitle="Sequência inteligente de corte que combina OPs abertas para máximo aproveitamento e menor perda de aço"
          actions={
            <Link
              href="/relatorios"
              className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-[#111927] px-4 py-2 text-xs font-bold uppercase tracking-wider text-slate-300 hover:bg-white/5 transition-all"
            >
              <ArrowLeft className="h-4 w-4" />
              Voltar aos Relatórios
            </Link>
          }
        />
      </div>

      <OtimizadorTuboView
        demandasIniciais={demandas}
        opsDisponiveis={opsDisponiveis}
      />
    </div>
  );
}
