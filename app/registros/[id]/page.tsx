import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { deleteModelo } from "@/lib/actions/modelos";
import { addPecaToEngate } from "@/lib/actions/pecas";
import { TIPO_MATERIAL_LABEL, SUFIXO_MATERIAL } from "@/lib/labels";
import Link from "next/link";
import { ImageUploader } from "@/components/image-uploader";
import { uploadImagemModelo, uploadImagemPeca } from "@/lib/actions/upload";
import { buscarImagensOrganizadas } from "@/lib/upload";

export default async function FichaEngatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const modeloId = Number(id);

  const [modelo, setores] = await Promise.all([
    prisma.modelo.findUnique({
      where: { id: modeloId },
      select: {
        id: true,
        codigo: true,
        nome: true,
        curva: true,
        imagemUrl: true,
        pecas: {
          select: {
            id: true,
            quantidadeNecessaria: true,
            peca: {
              select: {
                id: true,
                codigo: true,
                nome: true,
                medida: true,
                tipoMaterial: true,
                imagemUrl: true,
                observacao: true,
              },
            },
          },
          orderBy: { id: "asc" },
        },
      },
    }),
    prisma.setor.findMany({
      orderBy: { ordemPadrao: "asc" },
      select: { id: true, nome: true },
    }),
  ]);

  if (!modelo) notFound();

  const imagensOrganizadas = await buscarImagensOrganizadas(
    modelo.codigo,
    modelo.pecas.map((mp) => mp.peca.codigo),
  );
  const imagemModelo = modelo.imagemUrl ?? imagensOrganizadas.modelo;

  const boundAddPeca = addPecaToEngate.bind(null, modelo.id);
  const boundDeleteModelo = deleteModelo.bind(null, modelo.id);

  // Preview dos sufixos para o formulário (clientside não disponível em RSC, mas mostramos no placeholder)
  const sufixosPorTipo = SUFIXO_MATERIAL;

  return (
    <div className="flex h-[calc(100vh-80px)] w-full flex-col font-mono text-slate-300">
      
      {/* HEADER / TOPBAR */}
      <div className="flex shrink-0 items-center justify-between border-b border-[#1E293B] bg-[#0B101E] px-6 py-4">
        <div className="flex items-center gap-4">
          <Link
            href="/modelos"
            aria-label="Voltar para modelos cadastrados"
            title="Voltar para modelos cadastrados"
            className="text-cyan-500 hover:text-cyan-400"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-5 w-5" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </Link>
          <span className="text-[11px] font-bold tracking-[0.2em] text-cyan-500 uppercase">Monitor do Sistema / Detalhes do SKU</span>
        </div>
        <div className="flex items-center gap-6">
          <form action={boundDeleteModelo}>
            <button type="submit" className="text-[11px] font-bold tracking-wider text-red-500 hover:text-red-400 uppercase">
              Excluir Engate
            </button>
          </form>
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-emerald-400">
             <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981] animate-pulse"></span>
             Online
          </div>
        </div>
      </div>

      {/* ÁREA DO GRAFO COM GRID */}
      <div className="relative flex-1 overflow-auto bg-[#0B101E]">
        
        {/* SVG GRID BACKGROUND */}
        <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: 'linear-gradient(rgba(30, 41, 59, 0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(30, 41, 59, 0.4) 1px, transparent 1px)', backgroundSize: '40px 40px' }}></div>

        <div className="relative min-h-full min-w-max p-12 flex flex-col items-center">
          
          {/* INFO PANEL */}
          <div className="mb-8 flex w-full max-w-5xl items-start gap-3 rounded-sm border border-cyan-500/20 bg-cyan-500/5 px-4 py-3 text-left">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="mt-0.5 h-4 w-4 shrink-0 text-cyan-400" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="text-[11px] font-bold tracking-wider text-cyan-300 uppercase">SKU das peças: {modelo.codigo}-[sufixo]</p>
              <p className="mt-1 text-[11px] text-slate-400">
                Ex: <span className="font-mono text-slate-200">{modelo.codigo}-TB</span> = 1º tubo · <span className="font-mono text-slate-200">{modelo.codigo}-TB2</span> = 2º tubo · <span className="font-mono text-slate-200">{modelo.codigo}-RF</span> = reforço. Clique em uma peça para editar seus detalhes completos.
              </p>
            </div>
          </div>
          
          {/* NÓ MASTER (ENGATE) */}
          <div className="relative z-10 flex w-72 flex-col rounded-sm border-l-4 border-l-[#00c896] bg-[#131B2C] shadow-2xl ring-1 ring-white/5">
            <div className="flex items-center justify-between border-b border-white/5 px-4 py-3">
              <div className="flex items-center gap-2 text-cyan-400">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-4 w-4" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                <span className="text-[12px] font-bold tracking-wider">{modelo.codigo}</span>
              </div>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-4 w-4 text-slate-500"><path strokeLinecap="round" strokeLinejoin="round" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" /></svg>
            </div>
            <div className="p-4">
              <span className="block text-sm font-semibold text-white">{modelo.nome || 'Nome Pendente'}</span>
              <div className="mt-1 text-[10px] text-slate-500">{modelo.pecas.length} {modelo.pecas.length === 1 ? 'peça' : 'peças'} cadastradas</div>
              <div className="mt-4 flex items-end justify-between">
                <span className="rounded bg-[#00c896]/10 px-1.5 py-0.5 text-[10px] font-bold tracking-widest text-[#00c896] uppercase">Mestre</span>
                <span className="text-[10px] font-medium tracking-wider text-slate-500">CURVA {modelo.curva}</span>
              </div>
              <div className="mt-4 flex items-center justify-between border-t border-white/5 pt-3">
                <ImageUploader 
                  size="sm" 
                  label="Foto do modelo"
                  onUpload={async (formData) => {
                    "use server";
                    return uploadImagemModelo(modelo.id, formData);
                  }} 
                />
                {imagemModelo && (
                  <a href={imagemModelo} target="_blank" rel="noopener noreferrer" className="text-[10px] text-cyan-400 hover:underline">Ver Foto</a>
                )}
              </div>
            </div>
          </div>

          {/* LINHA CONECTORA */}
          <div className="w-px h-8 bg-cyan-500/50"></div>
          
          <div className="flex flex-col items-center">
            {/* Linha horizontal conectando os filhos */}
            {modelo.pecas.length > 0 && (
              <div className="border-t-2 border-cyan-500/50" style={{ width: `calc(100% - 240px)` }}></div>
            )}
            
            {/* CONTAINER DOS NÓS FILHOS */}
            <div className="relative z-10 flex gap-[60px] pt-8">
              
              {modelo.pecas.map((mp) => {
                const completo = !!(mp.peca.nome && mp.peca.medida);
                const borderColor = completo ? 'border-l-[#00E5FF]' : 'border-l-[#FF9100]';
                const iconColor = completo ? 'text-cyan-400' : 'text-[#FF9100]';
                const imagemPeca = mp.peca.imagemUrl ?? imagensOrganizadas.pecas.get(mp.peca.codigo);

                return (
                  <div key={mp.id} className="relative flex flex-col items-center">
                    {/* Linha vertical subindo para a linha horizontal */}
                    <div className="absolute top-[-32px] h-8 w-px bg-cyan-500/50"></div>
                    
                    <div className={`relative flex w-64 shrink-0 flex-col rounded-sm border-l-4 ${borderColor} bg-[#131B2C] shadow-2xl ring-1 ring-white/5`}>
                      <div className="flex items-center justify-between border-b border-white/5 px-4 py-3">
                        <div className={`flex items-center gap-2 ${iconColor}`}>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-4 w-4" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M14 10l-2 1m0 0l-2-1m2 1v2.5M20 7l-2 1m2-1l-2-1m2 1v2.5M14 4l-2-1-2 1M4 7l2-1M4 7l2 1M4 7v2.5M12 21l-2-1m2 1l2-1m-2 1v-2.5M6 18l-2-1v-2.5M18 18l2-1v-2.5" /></svg>
                          <span className="text-[12px] font-bold tracking-wider">{mp.peca.codigo}</span>
                        </div>
                        {!completo && (
                           <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-4 w-4 text-[#FF9100]"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                        )}
                      </div>
                      <div className="p-4">
                        <span className="block text-sm font-semibold text-white truncate" title={mp.peca.nome}>{mp.peca.nome}</span>
                        <span className="mt-0.5 block text-[10px] text-slate-500">{TIPO_MATERIAL_LABEL[mp.peca.tipoMaterial!] ?? mp.peca.tipoMaterial ?? "—"}</span>
                        {mp.peca.observacao && (
                          <span className="mt-1 block text-[10px] italic text-slate-600 truncate">{mp.peca.observacao}</span>
                        )}
                        
                        <div className="mt-4 flex border-t border-white/5 pt-3 text-[10px]">
                          <div className="flex w-1/2 flex-col gap-1 pr-2">
                            <span className="text-slate-500 uppercase">Qtd/engate</span>
                            <span className="font-medium text-white">{mp.quantidadeNecessaria}</span>
                          </div>
                          <div className="flex w-1/2 flex-col gap-1 border-l border-white/5 pl-3">
                            <span className="text-slate-500 uppercase">Medida</span>
                            <span className="font-medium text-white truncate">{mp.peca.medida || "—"}</span>
                          </div>
                        </div>
                        
                        <div className="mt-4 flex items-center justify-between border-t border-white/5 pt-3">
                          <ImageUploader 
                            size="sm" 
                            label="Foto para OP"
                            onUpload={async (formData) => {
                              "use server";
                              return uploadImagemPeca(mp.peca.id, modelo.id, formData);
                            }} 
                          />
                          {imagemPeca && (
                            <a href={imagemPeca} target="_blank" rel="noopener noreferrer" className="text-[10px] text-cyan-400 hover:underline">Ver Foto</a>
                          )}
                        </div>

                        {/* BOTÃO EDITAR */}
                        <Link
                          href={`/registros/pecas/${mp.peca.id}`}
                          className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-sm border border-cyan-500/30 bg-cyan-500/5 py-1.5 text-[10px] font-bold tracking-widest text-cyan-400 uppercase transition-colors hover:border-cyan-400 hover:bg-cyan-500/15"
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-3 w-3" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                          Editar Detalhes
                        </Link>

                        <p className="mt-2 truncate font-mono text-[9px] text-slate-600">
                          SKU: {mp.peca.codigo}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* NÓ "ADD BRANCH" */}
              <div className="relative flex flex-col items-center">
                {/* Linha vertical */}
                <div className="absolute top-[-32px] h-8 w-px bg-cyan-500/50"></div>
                
                <div className="relative flex w-64 shrink-0 flex-col rounded-sm border border-dashed border-slate-600 bg-[#131B2C]/50 shadow-2xl p-4 backdrop-blur-md">
                   <span className="text-center text-[10px] font-bold tracking-widest text-cyan-500 uppercase mb-4">+ Nova Peça</span>
                   
                   <form action={boundAddPeca} className="flex flex-col gap-2">
                    {/* TIPO DE MATERIAL → define o sufixo do SKU */}
                    <div className="flex flex-col gap-1">
                      <label className="text-[9px] font-bold tracking-widest text-slate-500 uppercase">Tipo de Material *</label>
                      <select name="tipoMaterial" required className="w-full rounded-sm bg-[#0B101E] border border-white/10 px-2 py-1.5 text-[11px] text-slate-300 focus:border-cyan-500 focus:outline-none uppercase tracking-wider">
                        <option value="">Selecione o material</option>
                        {Object.entries(TIPO_MATERIAL_LABEL).map(([v, label]) => (
                          <option key={v} value={v}>{label} → {modelo.codigo}-{sufixosPorTipo[v] ?? "OT"}</option>
                        ))}
                      </select>
                    </div>

                    {/* NOME / DESCRIÇÃO da peça */}
                    <div className="flex flex-col gap-1">
                      <label className="text-[9px] font-bold tracking-widest text-slate-500 uppercase">Nome / Descrição *</label>
                      <input
                        name="nome"
                        required
                        placeholder="Ex: Tubo Principal 50x50"
                        className="w-full rounded-sm bg-[#0B101E] border border-white/10 px-2 py-1.5 text-[11px] text-slate-300 placeholder-slate-600 focus:border-cyan-500 focus:outline-none"
                      />
                    </div>

                    {/* SETOR onde é fabricada */}
                    <div className="flex flex-col gap-1">
                      <label className="text-[9px] font-bold tracking-widest text-slate-500 uppercase">Fabricada em *</label>
                      <select name="setorId" required className="w-full rounded-sm bg-[#0B101E] border border-white/10 px-2 py-1.5 text-[11px] text-slate-300 focus:border-cyan-500 focus:outline-none uppercase tracking-wider">
                        <option value="">Selecione o setor</option>
                        {setores.map((s) => (
                          <option key={s.id} value={s.id}>{s.nome}</option>
                        ))}
                      </select>
                    </div>

                    {/* MEDIDA (texto livre para exibição) */}
                    <div className="flex flex-col gap-1">
                      <label className="text-[9px] font-bold tracking-widest text-slate-500 uppercase">Medida (exibição)</label>
                      <input name="medida" placeholder="Ex: 50x50mm, 3mm, 200mm" className="w-full rounded-sm bg-[#0B101E] border border-white/10 px-2 py-1.5 text-[11px] text-slate-300 placeholder-slate-600 focus:border-cyan-500 focus:outline-none tracking-wide" />
                    </div>

                    {/* MEDIDAS ESTRUTURADAS */}
                    <div className="flex gap-2">
                      <div className="flex flex-col gap-1 flex-1">
                        <label className="text-[9px] font-bold tracking-widest text-slate-500 uppercase">Larg (mm)</label>
                        <input name="medidaA" type="number" step="0.1" placeholder="0.0" className="w-full rounded-sm bg-[#0B101E] border border-white/10 px-2 py-1.5 text-[11px] text-slate-300 placeholder-slate-600 focus:border-cyan-500 focus:outline-none" />
                      </div>
                      <div className="flex flex-col gap-1 flex-1">
                        <label className="text-[9px] font-bold tracking-widest text-slate-500 uppercase">Alt (mm)</label>
                        <input name="medidaB" type="number" step="0.1" placeholder="0.0" className="w-full rounded-sm bg-[#0B101E] border border-white/10 px-2 py-1.5 text-[11px] text-slate-300 placeholder-slate-600 focus:border-cyan-500 focus:outline-none" />
                      </div>
                    </div>

                    {/* QUANTIDADE */}
                    <div className="flex flex-col gap-1">
                      <label className="text-[9px] font-bold tracking-widest text-slate-500 uppercase">Qtd por engate</label>
                      <input name="quantidade" type="number" min="1" defaultValue="1" className="w-full rounded-sm bg-[#0B101E] border border-white/10 px-2 py-1.5 text-[11px] text-slate-300 focus:border-cyan-500 focus:outline-none" />
                    </div>
                    
                    <button type="submit" className="mt-2 w-full rounded-sm bg-cyan-500/10 border border-cyan-500/50 px-2 py-2 text-[10px] font-bold tracking-widest text-cyan-400 hover:bg-cyan-500/20 hover:border-cyan-400 transition-colors uppercase">
                      Adicionar Peça ao Engate
                    </button>
                  </form>
                </div>
              </div>

            </div>
          </div>

        </div>
      </div>
      
    </div>
  );
}

