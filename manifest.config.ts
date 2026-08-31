import { defineManifest } from "@crxjs/vite-plugin";

// crxjs 的 ManifestV3 类型不包含 optional_host_permissions（这是合法的 MV3 字段）。
// 为了在保留其他字段的完整类型检查下支持该字段，用 satisfies 校验已知字段，
// 然后用交叉类型补充 optional_host_permissions。
const manifest = {
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
} satisfies {
  manifest_version: number;
  name: string;
  description: string;
  version: string;
  minimum_chrome_version: string;
  icons: Record<string, string>;
  action: object;
  background: object;
  side_panel: object;
  content_scripts: object[];
  permissions: string[];
  host_permissions: string[];
  optional_host_permissions: string[];
  commands: object;
};

export default defineManifest(manifest);
