import { defineManifest } from "@crxjs/vite-plugin";

export default defineManifest({
  manifest_version: 3,
  name: "Helper 助手",
  description: "一句话搞定提醒、计时与待办",
  version: "0.1.0",
  minimum_chrome_version: "114",
  icons: { "128": "icon-128.png" },
  action: { default_title: "打开 Helper 侧边栏" },
  background: { service_worker: "src/background/index.ts", type: "module" },
  side_panel: { default_path: "src/panel/index.html" },
  permissions: ["sidePanel", "alarms", "notifications", "storage"],
  host_permissions: [
    "http://localhost:3001/*",
    "https://helper-backend-production-6abe.up.railway.app/*",
  ],
});
