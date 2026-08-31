import { defineManifest } from "@crxjs/vite-plugin";

export default defineManifest({
  manifest_version: 3,
  name: "记得",
  description: "一句话搞定提醒、计时、待办与剪贴板",
  version: "0.7.0",
  minimum_chrome_version: "114",
  icons: {
    "16": "icon-16.png",
    "32": "icon-32.png",
    "48": "icon-48.png",
    "128": "icon-128.png",
  },
  action: {
    default_title: "打开「记得」侧边栏",
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
    {
      matches: ["<all_urls>"],
      js: ["src/content/screenshotOverlay.ts"],
      run_at: "document_idle",
    },
  ],
  permissions: ["sidePanel", "alarms", "notifications", "offscreen", "storage", "unlimitedStorage", "contextMenus", "clipboardWrite", "clipboardRead", "activeTab"],
  host_permissions: [
    "https://helper-backend-sigma.vercel.app/*",
    "https://api.deepseek.com/*",
  ],
  // <all_urls> 只做可选权限:右键菜单与快捷键靠 activeTab 就够,唯独侧边栏按钮点击
  // 不算扩展手势拿不到 activeTab,才需要用户主动授予。放进 optional 让用户能随时撤销。
  optional_host_permissions: ["<all_urls>"],
  commands: {
    "take-screenshot": {
      suggested_key: { default: "Ctrl+Shift+S", mac: "Command+Shift+S" },
      description: "Take a screenshot",
    },
  },
} as any);
