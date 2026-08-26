import { env } from "cloudflare:workers";
import { buscarOperadorLogado } from "@/lib/auth-operador";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  if (!(await buscarOperadorLogado())) return new Response("Nao autorizado", { status: 401 });
  const { path } = await params;
  const key = path.join("/");
  const object = await env.UPLOADS.get(key);

  if (!object) {
    const asset = await env.ASSETS.fetch(new Request(new URL(`/uploads/${key}`, _request.url)));
    if (asset.ok) {
      const headers = new Headers(asset.headers);
      headers.set("cache-control", "private, max-age=3600");
      return new Response(asset.body, { status: asset.status, headers });
    }
    return new Response("Imagem não encontrada", { status: 404 });
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("cache-control", "private, max-age=3600");
  return new Response(object.body, { headers });
}
