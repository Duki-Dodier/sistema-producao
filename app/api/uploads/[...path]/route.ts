import fs from "node:fs/promises";
import path from "node:path";
import { lookup } from "mime-types";

const UPLOADS_DIR = path.join(process.cwd(), "public", "uploads");

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path: segments } = await params;
  const filePath = path.join(UPLOADS_DIR, ...segments);

  // Previne path traversal
  if (!filePath.startsWith(UPLOADS_DIR)) {
    return new Response("Acesso negado", { status: 403 });
  }

  try {
    const buffer = await fs.readFile(filePath);
    const contentType = lookup(filePath) || "application/octet-stream";

    return new Response(buffer, {
      headers: {
        "content-type": contentType,
        "cache-control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new Response("Imagem não encontrada", { status: 404 });
  }
}

