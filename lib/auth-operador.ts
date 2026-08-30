import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ehSetor } from "@/lib/setores";

const COOKIE_NAME = "mes_operador_session";
const DURACAO_SESSAO_SEGUNDOS = 12 * 60 * 60;
// Cloudflare Workers limita PBKDF2 a 100.000 iteracoes.
const ITERACOES_SENHA = 100_000;

export type OperadorLogado = {
  id: number;
  nome: string;
  usuario: string;
  setorId: number;
  setorNome: string;
  papel: string;
  administrador: boolean;
  temPin: boolean;
  processosPermitidos: string[];
};

type FuncionarioComAcesso = {
  id: number;
  nome: string;
  usuario: string | null;
  setorId: number;
  papel: string;
  administrador: boolean;
  pin: string | null;
  setor: { nome: string };
  processosPermitidos: { processo: string }[];
};

function bytesParaHex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function hexParaBytes(hex: string) {
  if (!/^[0-9a-f]+$/i.test(hex) || hex.length % 2 !== 0) return null;
  return new Uint8Array(hex.match(/.{2}/g)?.map((byte) => Number.parseInt(byte, 16)) ?? []);
}

async function hashToken(token: string) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return bytesParaHex(new Uint8Array(bytes));
}

async function derivarSenha(senha: string, salt: Uint8Array, iteracoes: number) {
  const saltBuffer = Uint8Array.from(salt).buffer;
  const chave = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(senha),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: saltBuffer, iterations: iteracoes },
    chave,
    256,
  );
  return new Uint8Array(bits);
}

export function normalizarUsuario(valor: string) {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

export async function criarSenhaHash(senha: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derivarSenha(senha, salt, ITERACOES_SENHA);
  return `pbkdf2_sha256$${ITERACOES_SENHA}$${bytesParaHex(salt)}$${bytesParaHex(hash)}`;
}

async function verificarSenha(senha: string, senhaHash: string | null) {
  if (!senhaHash) return false;
  const [algoritmo, iteracoesRaw, saltHex, hashEsperado] = senhaHash.split("$");
  const salt = hexParaBytes(saltHex ?? "");
  const iteracoes = Number(iteracoesRaw);
  if (
    algoritmo !== "pbkdf2_sha256" ||
    !salt ||
    !Number.isInteger(iteracoes) ||
    iteracoes < 10_000 ||
    iteracoes > ITERACOES_SENHA ||
    !/^[0-9a-f]{64}$/i.test(hashEsperado ?? "")
  ) {
    return false;
  }
  const calculado = bytesParaHex(await derivarSenha(senha, salt, iteracoes));
  let diferenca = calculado.length ^ hashEsperado.length;
  for (let indice = 0; indice < calculado.length; indice++) {
    diferenca |= calculado.charCodeAt(indice) ^ (hashEsperado.charCodeAt(indice) || 0);
  }
  return diferenca === 0;
}

function mapOperador(funcionario: FuncionarioComAcesso): OperadorLogado {
  return {
    id: funcionario.id,
    nome: funcionario.nome,
    usuario: funcionario.usuario ?? normalizarUsuario(funcionario.nome.split(/\s+/)[0] ?? ""),
    setorId: funcionario.setorId,
    setorNome: funcionario.setor.nome,
    papel: funcionario.papel,
    administrador: funcionario.administrador,
    temPin: Boolean(funcionario.pin),
    processosPermitidos: funcionario.processosPermitidos.map((item) => item.processo),
  };
}

const acessoFuncionario = {
  setor: { select: { nome: true } },
  processosPermitidos: { select: { processo: true } },
} as const;

export async function buscarOperadorPorId(id: number) {
  return prisma.funcionario.findUnique({ where: { id }, include: acessoFuncionario });
}

export async function iniciarSessaoSistema(usuarioInformado: string, senha: string) {
  const usuario = normalizarUsuario(usuarioInformado);
  const funcionario = usuario
    ? await prisma.funcionario.findUnique({ where: { usuario }, include: acessoFuncionario })
    : null;
  if (!funcionario || !funcionario.ativo || !(await verificarSenha(senha, funcionario.senhaHash))) {
    throw new Error("Usuario ou senha incorretos.");
  }

  const token = crypto.randomUUID();
  const tokenHash = await hashToken(token);
  const expiraEm = new Date(Date.now() + DURACAO_SESSAO_SEGUNDOS * 1000);

  await prisma.$transaction([
    prisma.operadorSessao.deleteMany({ where: { expiraEm: { lt: new Date() } } }),
    prisma.operadorSessao.create({ data: { funcionarioId: funcionario.id, tokenHash, expiraEm } }),
  ]);

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: DURACAO_SESSAO_SEGUNDOS,
  });
  return mapOperador(funcionario);
}

export async function buscarOperadorLogado(): Promise<OperadorLogado | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;

  const sessao = await prisma.operadorSessao.findUnique({
    where: { tokenHash: await hashToken(token) },
    include: { funcionario: { include: acessoFuncionario } },
  });

  if (!sessao || sessao.expiraEm <= new Date() || !sessao.funcionario.ativo) return null;
  return mapOperador(sessao.funcionario);
}

export async function exigirUsuarioLogado() {
  const usuario = await buscarOperadorLogado();
  if (!usuario) redirect("/login");
  return usuario;
}

export async function exigirAdministrador() {
  const usuario = await exigirUsuarioLogado();
  if (!usuario.administrador) throw new Error("Acesso permitido apenas ao administrador.");
  return usuario;
}

export function destinoInicial(usuario: OperadorLogado) {
  if (usuario.administrador || usuario.papel === "PCP") return "/";
  return `/apontamentos?setor=${usuario.setorId}`;
}

export function podeAcessarRota(usuario: OperadorLogado, pathname: string) {
  if (usuario.administrador) return true;
  if (pathname === "/login") return true;
  if (usuario.papel === "OPERADOR") {
    if (pathname.startsWith("/plasma")) {
      return ehSetor(usuario.setorNome, "Plasma Chapa") || ehSetor(usuario.setorNome, "Plasma Tubo");
    }
    return pathname.startsWith("/apontamentos");
  }
  if (usuario.papel === "LIDER") {
    return ["/", "/monitoramento", "/plasma", "/ponteiras", "/relatorios", "/agrupamento", "/solda", "/apontamentos"].some(
      (rota) => rota === "/" ? pathname === "/" : pathname.startsWith(rota),
    );
  }
  if (usuario.papel === "PCP") return !pathname.startsWith("/configuracoes");
  return false;
}

export async function encerrarSessaoOperador() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (token) {
    await prisma.operadorSessao.deleteMany({ where: { tokenHash: await hashToken(token) } });
  }
  cookieStore.delete(COOKIE_NAME);
}
