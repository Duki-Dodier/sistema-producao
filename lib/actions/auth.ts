"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  destinoInicial,
  encerrarSessaoOperador,
  iniciarSessaoSistema,
  podeAcessarRota,
} from "@/lib/auth-operador";

function destinoSeguro(valor: string) {
  return valor.startsWith("/") && !valor.startsWith("//") ? valor : "";
}

function destinoDeOperadorComLeitura(destino: string) {
  if (destino === "/apontamentos/scanner" || destino.startsWith("/apontamentos/scanner?")) return true;
  if (/^\/plasma\/(operar|apontar)\/\d+(?:\?|$)/.test(destino)) return true;
  if (!destino.startsWith("/apontamentos?")) return false;
  const parametros = new URLSearchParams(destino.slice(destino.indexOf("?") + 1));
  return /^\d+$/.test(parametros.get("op") ?? "");
}

export async function loginSistema(formData: FormData) {
  const usuario = String(formData.get("usuario") ?? "").trim();
  const senha = String(formData.get("senha") ?? "");
  const destinoSolicitado = destinoSeguro(String(formData.get("redirect") ?? ""));

  if (!usuario || !senha) {
    const retorno = destinoSolicitado ? `&redirect=${encodeURIComponent(destinoSolicitado)}` : "";
    redirect(`/login?erro=Informe%20usuario%20e%20senha.${retorno}`);
  }

  let conectado;
  try {
    conectado = await iniciarSessaoSistema(usuario, senha);
  } catch (error) {
    const mensagem = error instanceof Error ? error.message : "Nao foi possivel iniciar a sessao.";
    const retorno = destinoSolicitado ? `&redirect=${encodeURIComponent(destinoSolicitado)}` : "";
    redirect(`/login?erro=${encodeURIComponent(mensagem)}${retorno}`);
  }

  const destinoPermitido = conectado.papel === "OPERADOR"
    ? destinoDeOperadorComLeitura(destinoSolicitado)
    : Boolean(destinoSolicitado && podeAcessarRota(conectado, destinoSolicitado));
  const destino = destinoPermitido
    ? destinoSolicitado
    : destinoInicial(conectado);
  redirect(destino);
}

export async function sairSistema() {
  await encerrarSessaoOperador();
  revalidatePath("/", "layout");
  redirect("/login");
}
