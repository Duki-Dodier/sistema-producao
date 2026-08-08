import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { deleteModelo } from "@/lib/actions/modelos";
import { addPecaToEngate, updatePecaMedidas } from "@/lib/actions/pecas";
import { TIPO_MATERIAL_LABEL } from "@/lib/labels";
import Link from "next/link";
import { ImageUploader } from "@/components/image-uploader";
import { uploadImagemModelo, uploadImagemPeca } from "@/lib/actions/upload";
import { buscarImagensOrganizadas } from "@/lib/upload";
import { SubmitButton } from "@/components/submit-button";

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
                medidaA: true,
                medidaB: true,
                espessuraMm: true,
                comprimentoMm: true,
                tipoMaterial: true,
                imagemUrl: true,
              },
            },
          },
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

  return (
    <div className="flex h-[calc(100vh-80px)] w-full flex-col font-mono text-slate-300">
      
      {/* HEADER / TOPBAR ESTILO SYSTEM MONITOR */}
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

      {/* ÁREA DO GRAFO COM GRID (SVG) */}
      <div className="relative flex-1 overflow-auto bg-[#0B101E]">
        
        {/* SVG GRID BACKGROUND */}
        <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: 'linear-gradient(rgba(30, 41, 59, 0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(30, 41, 59, 0.4) 1px, transparent 1px)', backgroundSize: '40px 40px' }}></div>

        <div className="relative min-h-full min-w-max p-12 flex flex-col items-center">
          <div className="mb-8 flex w-full max-w-5xl items-start gap-3 rounded-sm border border-cyan-500/20 bg-cyan-500/5 px-4 py-3 text-left">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="mt-0.5 h-4 w-4 shrink-0 text-cyan-400" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 7.5V6A1.5 1.5 0 014.5 4.5h5.379a1.5 1.5 0 011.06.44l.621.62a1.5 1.5 0 001.06.44H19.5A1.5 1.5 0 0121 7.5v10.5a1.5 1.5 0 01-1.5 1.5h-15A1.5 1.5 0 013 18V7.5z" />
            </svg>
            <div>
              <p className="text-[11px] font-bold tracking-wider text-cyan-300 uppercase">Imagens da OP organizadas por modelo</p>
              <p className="mt-1 text-[11px] text-slate-400">
                Pasta <span className="font-mono text-slate-200">{modelo.codigo}/</span>: a foto do engate fica em <span className="font-mono text-slate-200">modelo/</span> e cada peça em <span className="font-mono text-slate-200">pecas/</span>, identificada pelo código da peça.
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
              <div className="mt-6 flex items-end justify-between">
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

          {/* LINHAS CONECTORAS (CSS TREE) */}
          <div className="w-px h-8 bg-cyan-500/50"></div>
          
          <div className="flex flex-col items-center">
            {/* Linha horizontal conectando os filhos */}
            <div className="border-t-2 border-cyan-500/50" style={{ width: `calc(100% - 240px)` }}></div>
            
            {/* CONTAINER DOS NÓS FILHOS */}
            <div className="relative z-10 flex gap-[60px] pt-8">
              
              {modelo.pecas.map((mp) => {
                const possuiMedida = Boolean(mp.peca.medida?.trim()) ||
                  [mp.peca.medidaA, mp.peca.medidaB, mp.peca.espessuraMm, mp.peca.comprimentoMm]
                    .some((valor) => valor !== null);
                const pending = !possuiMedida;
                const borderColor = pending ? 'border-l-[#FF9100]' : 'border-l-[#00E5FF]';
                const iconColor = pending ? 'text-[#FF9100]' : 'text-cyan-400';
                const imagemPeca = mp.peca.imagemUrl ?? imagensOrganizadas.pecas.get(mp.peca.codigo);
                const boundUpdatePecaMedidas = updatePecaMedidas.bind(null, mp.peca.id, modelo.id);

                return (
                  <div key={mp.id} className="relative flex flex-col items-center">
                    {/* Linha vertical subindo para a linha horizontal */}
                    <div className="absolute top-[-32px] h-8 w-px bg-cyan-500/50"></div>
                    
                    <div className={`relative flex w-60 shrink-0 flex-col rounded-sm border-l-4 ${borderColor} bg-[#131B2C] shadow-2xl ring-1 ring-white/5`}>
                      <div className="flex items-center justify-between border-b border-white/5 px-4 py-3">
                        <div className={`flex items-center gap-2 ${iconColor}`}>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-4 w-4" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M14 10l-2 1m0 0l-2-1m2 1v2.5M20 7l-2 1m2-1l-2-1m2 1v2.5M14 4l-2-1-2 1M4 7l2-1M4 7l2 1M4 7v2.5M12 21l-2-1m2 1l2-1m-2 1v-2.5M6 18l-2-1v-2.5M18 18l2-1v-2.5" /></svg>
                          <span className="text-[12px] font-bold tracking-wider">{mp.peca.codigo}</span>
                        </div>
                        {pending && (
                           <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-4 w-4 text-[#FF9100]"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                        )}
                      </div>
                      <div className="p-4">
                        <span className="block text-sm font-semibold text-white truncate">{mp.peca.nome}</span>
                        <span className="mt-1 block text-[10px] text-slate-500">{TIPO_MATERIAL_LABEL[mp.peca.tipoMaterial!] ?? mp.peca.tipoMaterial}</span>
                        
                        <div className="mt-5 flex border-t border-white/5 pt-3 text-[10px]">
                          <div className="flex w-1/2 flex-col gap-1 pr-2">
                            <span className="text-slate-500 uppercase">Qtd</span>
                            <span className="font-medium text-white">{mp.quantidadeNecessaria}</span>
                          </div>
                          <div className="flex w-1/2 flex-col gap-1 border-l border-white/5 pl-3">
                            <span className="text-slate-500 uppercase">Status</span>
                            <span className={`font-bold uppercase tracking-wide ${pending ? 'text-[#FF9100]' : 'text-[#00c896]'}`}>
                               {pending ? 'Pendente' : 'Verificado'}
                            </span>
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
                        {pending && (
                          <form action={boundUpdatePecaMedidas} className="mt-3 border-t border-[#FF9100]/20 pt-3">
                            <p className="mb-2 text-[9px] font-bold uppercase tracking-wider text-[#FFB454]">
                              Completar medidas da peça
                            </p>
                            <input
                              name="medida"
                              defaultValue={mp.peca.medida ?? ""}
                              placeholder="Ex.: 6,35 mm"
                              className="w-full rounded-sm border border-white/10 bg-[#0B101E] px-2 py-1.5 text-[10px] text-slate-200 placeholder-slate-600 focus:border-[#FF9100] focus:outline-none"
                            />
                            <div className="mt-2 grid grid-cols-2 gap-1.5">
                              <input
                                name="medidaA"
                                type="number"
                                step="0.1"
                                defaultValue={mp.peca.medidaA ?? ""}
                                placeholder="Larg./diâm."
                                className="w-full rounded-sm border border-white/10 bg-[#0B101E] px-2 py-1.5 text-[10px] text-slate-200 placeholder-slate-600 focus:border-[#FF9100] focus:outline-none"
                              />
                              <input
                                name="medidaB"
                                type="number"
                                step="0.1"
                                defaultValue={mp.peca.medidaB ?? ""}
                                placeholder="Altura"
                                className="w-full rounded-sm border border-white/10 bg-[#0B101E] px-2 py-1.5 text-[10px] text-slate-200 placeholder-slate-600 focus:border-[#FF9100] focus:outline-none"
                              />
                              <input
                                name="espessuraMm"
                                type="number"
                                step="0.1"
                                defaultValue={mp.peca.espessuraMm ?? ""}
                                placeholder="Espessura"
                                className="w-full rounded-sm border border-white/10 bg-[#0B101E] px-2 py-1.5 text-[10px] text-slate-200 placeholder-slate-600 focus:border-[#FF9100] focus:outline-none"
                              />
                              <input
                                name="comprimentoMm"
                                type="number"
                                step="0.1"
                                defaultValue={mp.peca.comprimentoMm ?? ""}
                                placeholder="Comprimento"
                                className="w-full rounded-sm border border-white/10 bg-[#0B101E] px-2 py-1.5 text-[10px] text-slate-200 placeholder-slate-600 focus:border-[#FF9100] focus:outline-none"
                              />
                            </div>
                            <SubmitButton
                              pendingText="Salvando..."
                              className="mt-2 w-full rounded-sm border border-[#FF9100]/50 bg-[#FF9100]/10 px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[#FFB454] hover:bg-[#FF9100]/20"
                            >
                              Salvar medidas
                            </SubmitButton>
                          </form>
                        )}
                        <p className="mt-2 truncate font-mono text-[9px] text-slate-500">
                          {modelo.codigo}/pecas/{mp.peca.codigo}-...
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
                
                <div className="relative flex w-60 shrink-0 flex-col rounded-sm border border-dashed border-slate-600 bg-[#131B2C]/50 shadow-2xl p-4 backdrop-blur-md">
                   <span className="text-center text-[10px] font-bold tracking-widest text-cyan-500 uppercase mb-4">+ Adicionar Peça</span>
                   
                   <form action={boundAddPeca} className="flex flex-col gap-2">
                    <select name="tipoMaterial" required className="w-full rounded-sm bg-[#0B101E] border border-white/10 px-2 py-1.5 text-[11px] text-slate-300 focus:border-cyan-500 focus:outline-none uppercase tracking-wider">
                      <option value="">O que é a peça?</option>
                      {Object.entries(TIPO_MATERIAL_LABEL).map(([v, label]) => (
                        <option key={v} value={v}>{label}</option>
                      ))}
                    </select>
                    <select name="setorId" required className="w-full rounded-sm bg-[#0B101E] border border-white/10 px-2 py-1.5 text-[11px] text-slate-300 focus:border-cyan-500 focus:outline-none uppercase tracking-wider">
                      <option value="">Feita em qual Setor?</option>
                      {setores.map((s) => (
                        <option key={s.id} value={s.id}>{s.nome}</option>
                      ))}
                    </select>
                    
                    <input name="medida" placeholder="Esp./Nome (Ex: 50x50mm)" className="w-full rounded-sm bg-[#0B101E] border border-white/10 px-2 py-1.5 text-[11px] text-slate-300 placeholder-slate-600 focus:border-cyan-500 focus:outline-none tracking-wide" />
                    
                    <div className="flex gap-2">
                      <input name="medidaA" type="number" step="0.1" placeholder="Larg" className="w-full rounded-sm bg-[#0B101E] border border-white/10 px-2 py-1.5 text-[11px] text-slate-300 placeholder-slate-600 focus:border-cyan-500 focus:outline-none" />
                      <input name="medidaB" type="number" step="0.1" placeholder="Alt" className="w-full rounded-sm bg-[#0B101E] border border-white/10 px-2 py-1.5 text-[11px] text-slate-300 placeholder-slate-600 focus:border-cyan-500 focus:outline-none" />
                    </div>
                    
                    <div className="flex gap-2 items-center">
                      <input name="quantidade" type="number" min="1" defaultValue="1" placeholder="Qtd" className="w-12 rounded-sm bg-[#0B101E] border border-white/10 px-2 py-1.5 text-[11px] text-slate-300 focus:border-cyan-500 focus:outline-none" />
                      <span className="text-[10px] text-slate-500">x Unidades</span>
                    </div>
                    
                    <button type="submit" className="mt-3 w-full rounded-sm bg-cyan-500/10 border border-cyan-500/50 px-2 py-1.5 text-[10px] font-bold tracking-widest text-cyan-400 hover:bg-cyan-500/20 hover:border-cyan-400 transition-colors uppercase">
                      Registrar Componente
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
