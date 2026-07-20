import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

const TIPOS_ACEITOS = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const TAMANHO_MAXIMO_BYTES = 1024 * 1024;

/**
 * Salva um arquivo de imagem enviado num `<input type="file">` em
 * `public/uploads/<pasta>/` e devolve o caminho público (ex.: "/uploads/pecas/xxx.jpg").
 * Devolve null se nenhum arquivo válido foi enviado (input vazio é comum e não é erro).
 */
export async function salvarImagem(
  file: FormDataEntryValue | null,
  pasta: string,
): Promise<string | null> {
  if (!(file instanceof File) || file.size === 0) return null;
  if (!TIPOS_ACEITOS.has(file.type)) {
    throw new Error("Formato de imagem não suportado. Use JPG, PNG, WEBP ou GIF.");
  }
  if (file.size > TAMANHO_MAXIMO_BYTES) {
    throw new Error("A imagem deve ter no máximo 1 MB.");
  }

  const ext = file.type.split("/")[1] === "jpeg" ? "jpg" : file.type.split("/")[1];
  const nomeArquivo = `${crypto.randomUUID()}.${ext}`;
  const dirAbsoluto = path.join(process.cwd(), "public", "uploads", pasta);
  await mkdir(dirAbsoluto, { recursive: true });

  const bytes = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(dirAbsoluto, nomeArquivo), bytes);

  return `/uploads/${pasta}/${nomeArquivo}`;
}
