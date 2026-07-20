import { createModelo } from "@/lib/actions/modelos";
import Link from "next/link";

export default function NovoSKUPage() {
  return (
    <div className="flex h-full w-full flex-col font-sans text-slate-300 bg-[#242D3C] overflow-hidden">
      
      {/* HEADER / TOPBAR */}
      <div className="flex shrink-0 items-center justify-between border-b border-white/5 bg-[#1E293B] px-6 py-4 shadow-sm">
        <div className="flex items-center gap-3">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-5 w-5 text-[#3B82F6]" strokeWidth={2}>
            <polygon points="12 2 15 8.5 22 9.3 17 14 18.2 21 12 17.3 5.8 21 7 14 2 9.3 9 8.5 12 2" />
          </svg>
          <span className="text-sm font-semibold tracking-wide text-slate-100">Engenharia: Cadastrar Novo Modelo (SKU)</span>
        </div>
        <Link href="/modelos" className="text-xs font-medium text-slate-400 hover:text-white">
          ← Voltar para lista
        </Link>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
         <div className="mx-auto max-w-2xl">
            
            <form action={createModelo} className="rounded-lg bg-[#2C3645] border border-white/5 shadow-lg overflow-hidden flex flex-col">
               <div className="bg-[#1A222C] px-6 py-4 border-b border-white/5">
                  <h2 className="text-sm font-semibold text-white">Dados do Produto Mestre</h2>
                  <p className="mt-1 text-xs text-slate-400">Preencha os dados básicos. Na próxima tela você poderá adicionar a foto e as peças (tubos, chapas) visualmente.</p>
               </div>
               
               <div className="p-6 flex flex-col gap-6">
                  <div className="flex flex-col gap-1.5">
                     <label className="text-[11px] font-medium uppercase tracking-wider text-slate-400">Código (SKU)</label>
                     <input 
                       name="codigo" 
                       required 
                       placeholder="Ex: AD1001" 
                       className="w-full rounded bg-[#1A222C] border border-slate-700 px-4 py-2.5 text-sm text-slate-200 placeholder-slate-600 focus:border-[#3B82F6] focus:outline-none transition-colors" 
                     />
                  </div>
                  
                  <div className="flex flex-col gap-1.5">
                     <label className="text-[11px] font-medium uppercase tracking-wider text-slate-400">Nome / Aplicação</label>
                     <input 
                       name="nome" 
                       required
                       placeholder="Ex: Engate Fixo Audi A3 Sedan 2012 até 2019" 
                       className="w-full rounded bg-[#1A222C] border border-slate-700 px-4 py-2.5 text-sm text-slate-200 placeholder-slate-600 focus:border-[#3B82F6] focus:outline-none transition-colors" 
                     />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-6">
                    <div className="flex flex-col gap-1.5">
                       <label className="text-[11px] font-medium uppercase tracking-wider text-slate-400">Curva ABC</label>
                       <select name="curva" className="w-full rounded bg-[#1A222C] border border-slate-700 px-4 py-2.5 text-sm text-slate-200 focus:border-[#3B82F6] focus:outline-none transition-colors">
                         <option value="A">Curva A (Alta Saída)</option>
                         <option value="B">Curva B (Média Saída)</option>
                         <option value="C">Curva C (Baixa Saída)</option>
                       </select>
                    </div>

                    <div className="flex flex-col gap-1.5">
                       <label className="text-[11px] font-medium uppercase tracking-wider text-slate-400">Tipo de Engate</label>
                       <select name="tipo" className="w-full rounded bg-[#1A222C] border border-slate-700 px-4 py-2.5 text-sm text-slate-200 focus:border-[#3B82F6] focus:outline-none transition-colors">
                         <option value="FIXO">Fixo</option>
                         <option value="REMOVIVEL">Removível</option>
                       </select>
                    </div>
                  </div>
               </div>

               <div className="bg-[#1A222C] px-6 py-4 border-t border-white/5 flex justify-end">
                  <button type="submit" className="rounded bg-[#3B82F6] px-8 py-2.5 text-xs font-bold tracking-wider text-white uppercase shadow-lg shadow-blue-500/20 hover:bg-blue-500 transition-colors flex items-center gap-2">
                    Criar Engate →
                  </button>
               </div>
            </form>

         </div>
      </div>
    </div>
  );
}
