import { defineManifest } from "@crxjs/vite-plugin";

export default defineManifest({
  manifest_version: 3,
  name: "Helper 助手",
  description: "一句话搞定提醒、计时与待办",
  version: "0.1.0",
  minimum_chrome_version: "114",
  icons: {
    "16": "icon-16.png",
    "32": "icon-32.png",
    "48": "icon-48.png",
    "128": "icon-128.png",
  },
  action: {
    default_title: "打开 Helper 侧边栏",
    default_icon: {
      "16": "icon-16.png",
      "32": "icon-32.png",
      "48": "icon-48.png",
      "128": "icon-128.png",
    },
  },
  background: { service_worker: "src/background/index.ts", type: "module" },
  side_panel: { default_path: "src/panel/index.html" },
  content_scripts: [
    {
      matches: ["<all_urls>"],
      js: ["src/content/clipboardCapture.ts"],
      run_at: "document_idle",
    },
  ],
  permissions: ["sidePanel", "alarms", "notifications", "storage", "unlimitedStorage", "contextMenus", "clipboardWrite", "clipboardRead"],
  host_permissions: [
    "https://helper-backend-production-6abe.up.railway.app/*",
    "https://api.deepseek.com/*",
  ],
});
