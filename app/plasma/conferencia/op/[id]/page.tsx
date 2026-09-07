import { notFound, redirect } from "next/navigation";

/** Compatibilidade para QR Codes gerados antes da tela simplificada. */
export default async function PlasmaConferenciaOpPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const [{ id: idRaw }, sp] = await Promise.all([params, searchParams]);
  const opId = Number(idRaw);
  if (!Number.isInteger(opId) || opId < 1) notFound();

  const destino = new URLSearchParams({ origem: "qrcode", op: String(opId) });
  if (sp.setor) destino.set("setor", sp.setor);
  if (sp.peca) destino.set("peca", sp.peca);
  if (sp.quantidade) destino.set("quantidade", sp.quantidade);
  redirect(`/apontamentos?${destino.toString()}`);
}
