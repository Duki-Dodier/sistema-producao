import { env } from "cloudflare:workers";

const TIPOS_ACEITOS = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const TAMANHO_MAXIMO_BYTES = 1024 * 1024;

function segmentoSeguro(valor: string, fallback: string) {
  const normalizado = valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalizado || fallback;
}

/**
 * Salva uma imagem no armazenamento persistente da hospedagem e devolve a URL pública.
 * Devolve null se nenhum arquivo válido foi enviado (input vazio é comum e não é erro).
 */
export async function salvarImagem(
  file: FormDataEntryValue | null,
  pasta: string,
  nomeBase = "imagem",
): Promise<string | null> {
  if (!(file instanceof File) || file.size === 0) return null;
  if (!TIPOS_ACEITOS.has(file.type)) {
    throw new Error("Formato de imagem não suportado. Use JPG, PNG, WEBP ou GIF.");
  }
  if (file.size > TAMANHO_MAXIMO_BYTES) {
    throw new Error("A imagem deve ter no máximo 1 MB.");
  }

  const ext = file.type.split("/")[1] === "jpeg" ? "jpg" : file.type.split("/")[1];
  const nomeArquivo = `${segmentoSeguro(nomeBase, "IMAGEM")}-${crypto.randomUUID()}.${ext}`;
  const chave = `${pasta}/${nomeArquivo}`;
  await env.UPLOADS.put(chave, await file.arrayBuffer(), {
    httpMetadata: { contentType: file.type },
  });

  return `/api/uploads/${chave}`;
}
