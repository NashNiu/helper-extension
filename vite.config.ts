/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { crx } from "@crxjs/vite-plugin";
import path from "path";
import { fileURLToPath } from "url";
import manifest from "./manifest.config";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react(), tailwindcss(), crx({ manifest })],
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
  // CRXJS 需要固定的 HMR 端口
  server: { port: 5174, strictPort: true, hmr: { port: 5174 } },
  test: { environment: "happy-dom", globals: true },
} as any);
