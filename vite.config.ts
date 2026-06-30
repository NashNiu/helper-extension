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
  server: {
    port: 5174,
    strictPort: true,
    // Vite 6.1+ 收紧了 dev server CORS 默认值，需显式放行扩展源，
    // 否则 service worker / 面板从 chrome-extension:// 拉 localhost 模块会被 CORS 拦截（SW 注册 status 3）。
    cors: { origin: [/^chrome-extension:\/\//] },
  },
  // @ts-expect-error Vitest augments Vite's config with `test`; vite's own UserConfig type omits it
  test: { environment: "happy-dom", globals: true },
});
