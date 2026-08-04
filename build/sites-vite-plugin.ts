import { access, cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { Plugin } from "vite";

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}

export function sites(): Plugin {
  let root = process.cwd();
  return {
    name: "sites",
    apply: "build",
    configResolved(config) {
      root = config.root;
    },
    async closeBundle() {
      const outputDirectory = resolve(root, "dist", ".openai");
      const workerConfig = resolve(root, "dist", "server", "wrangler.json");
      const hostingConfig = resolve(root, ".openai", "hosting.json");
      const drizzleSource = resolve(root, "drizzle");

      // O Sites já habilita nodejs_compat no runtime. A flag ainda é necessária
      // durante o bundle, mas repeti-la no artefato passou a invalidar o deploy.
      if (await exists(workerConfig)) {
        const config = JSON.parse(await readFile(workerConfig, "utf8")) as {
          compatibility_flags?: string[];
        };
        config.compatibility_flags =
          config.compatibility_flags?.filter((flag) => flag !== "nodejs_compat") ?? [];
        await writeFile(workerConfig, `${JSON.stringify(config)}\n`, "utf8");
      }

      await rm(outputDirectory, { recursive: true, force: true });
      await mkdir(outputDirectory, { recursive: true });
      if (await exists(hostingConfig)) await cp(hostingConfig, resolve(outputDirectory, "hosting.json"));
      if (await exists(drizzleSource)) {
        await cp(drizzleSource, resolve(outputDirectory, "drizzle"), { recursive: true });
      }
    },
  };
}
