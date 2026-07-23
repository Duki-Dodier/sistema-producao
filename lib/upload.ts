import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

const TIPOS_ACEITOS = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const TAMANHO_MAXIMO_BYTES = 1024 * 1024;
const UPLOADS_DIR = path.join(process.cwd(), "public", "uploads");

function segmentoSeguro(valor: string, fallback: string) {
  const normalizado = valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalizado || fallback;
}

type ImagensOrganizadas = {
  modelo: string | null;
  pecas: Map<string, string>;
};

export async function buscarImagensOrganizadas(
  codigoModelo: string,
  codigosPecas: string[],
): Promise<ImagensOrganizadas> {
  const pastaModelo = segmentoSeguro(codigoModelo, "MODELO");
  const objetos: Array<{ key: string; uploaded: Date }> = [];
  
  const dirPath = path.join(UPLOADS_DIR, codigoModelo);
  
  try {
    async function lerDiretorioRecursivamente(dir: string, baseDir: string = dir) {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          await lerDiretorioRecursivamente(fullPath, baseDir);
        } else {
          const stats = await fs.stat(fullPath);
          const key = fullPath.replace(path.join(UPLOADS_DIR, path.sep), "").replace(/\\/g, "/");
          objetos.push({
            key,
            uploaded: stats.mtime,
          });
        }
      }
    }
    
    await lerDiretorioRecursivamente(dirPath);
  } catch (error: any) {
    if (error.code !== "ENOENT") {
      console.error("Erro ao ler diretório de uploads:", error);
    }
  }

  const maisRecente = (prefixo: string) => {
    const encontrado = objetos
      .filter((objeto) => objeto.key.startsWith(prefixo))
      .sort((a, b) => b.uploaded.getTime() - a.uploaded.getTime())[0];
    return encontrado ? `/uploads/${encontrado.key}` : null;
  };

  const pecas = new Map<string, string>();
  for (const codigoPeca of codigosPecas) {
    const nomePeca = segmentoSeguro(codigoPeca, "PECA");
    const imagem = maisRecente(`${codigoModelo}/pecas/${nomePeca}-`);
    if (imagem) pecas.set(codigoPeca, imagem);
  }

  return {
    modelo: maisRecente(`${codigoModelo}/modelo/${pastaModelo}-`),
    pecas,
  };
}

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
  const absolutePath = path.join(UPLOADS_DIR, chave);
  
  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  const buffer = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(absolutePath, buffer);

  return `/uploads/${chave}`;
}
