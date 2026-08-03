import { env } from "cloudflare:workers";
import { buscarOperadorLogado } from "@/lib/auth-operador";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  if (!(await buscarOperadorLogado())) return new Response("Nao autorizado", { status: 401 });
  const { path } = await params;
  const object = await env.UPLOADS.get(path.join("/"));

  if (!object) return new Response("Imagem não encontrada", { status: 404 });

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("cache-control", "private, max-age=3600");
  return new Response(object.body, { headers });
}
