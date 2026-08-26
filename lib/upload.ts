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

type ImagensOrganizadas = {
  modelo: string | null;
  pecas: Map<string, string>;
};

type ImagemManifestada = {
  key: string;
  uploaded: number;
};

async function listarImagensLocais(codigoModelo: string) {
  try {
    const resposta = await env.ASSETS.fetch(new Request("https://assets.local/uploads-manifest.json"));
    if (!resposta.ok) return null;
    const manifesto = await resposta.json() as ImagemManifestada[];
    return manifesto
      .filter((objeto) => objeto.key.startsWith(`${codigoModelo}/`))
      .map((objeto) => ({ key: objeto.key, uploaded: new Date(objeto.uploaded) }));
  } catch {
    return null;
  }
}

/**
 * Recupera imagens organizadas que ainda existem no R2 mesmo quando uma
 * referência antiga do banco foi removida. Uma única listagem atende o modelo
 * e todas as peças, evitando várias chamadas ao armazenamento.
 */
export async function buscarImagensOrganizadas(
  codigoModelo: string,
  codigosPecas: string[],
): Promise<ImagensOrganizadas> {
  const pastaModelo = segmentoSeguro(codigoModelo, "MODELO");
  const objetosLocais = await listarImagensLocais(codigoModelo);
  const objetos: Array<{ key: string; uploaded: Date }> = objetosLocais ?? [];

  if (!objetosLocais) {
    let cursor: string | undefined;
    do {
      const pagina = await env.UPLOADS.list({
        prefix: `${codigoModelo}/`,
        cursor,
      });
      objetos.push(...pagina.objects.map((objeto) => ({
        key: objeto.key,
        uploaded: objeto.uploaded,
      })));
      cursor = pagina.truncated ? pagina.cursor : undefined;
    } while (cursor);
  }

  const maisRecente = (prefixo: string) => {
    const encontrado = objetos
      .filter((objeto) => objeto.key.startsWith(prefixo))
      .sort((a, b) => b.uploaded.getTime() - a.uploaded.getTime())[0];
    return encontrado ? `/api/uploads/${encontrado.key}` : null;
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
