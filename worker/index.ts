import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";
import { comPrisma } from "@/lib/prisma";

interface Env {
  ASSETS?: Fetcher;
  DB: D1Database;
  UPLOADS: R2Bucket;
  IMAGES?: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/_vinext/image") {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      const handlers = {
        fetchAsset: (path: string) => {
          const assetRequest = new Request(new URL(path, request.url), request);
          return env.ASSETS?.fetch
            ? env.ASSETS.fetch(assetRequest)
            : fetch(assetRequest);
        },
        ...(env.IMAGES?.input
          ? {
            transformImage: async (body: ReadableStream, { width, format, quality }: { width: number; format: string; quality: number }) => {
              const result = await env.IMAGES!.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
              return result.response();
            },
          }
          : {}),
      };
      return handleImageOptimization(request, handlers, allowedWidths);
    }
    return comPrisma(env.DB, () => handler.fetch(request, env, ctx));
  },
};

export default worker;
