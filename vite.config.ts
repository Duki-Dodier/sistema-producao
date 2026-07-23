import vinext from "vinext";
import { defineConfig } from "vite";
import hostingConfig from "./.openai/hosting.json";
import { sites } from "./build/sites-vite-plugin";

export default defineConfig(async () => {
  return {
    plugins: [
      vinext(),
      sites(),
    ],
  };
});
