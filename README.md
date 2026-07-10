# 记得 浏览器扩展

[English](README.en.md)

Chrome 侧边栏(Side Panel)扩展:一句话搞定提醒、计时、待办与剪贴板。**本地优先、隐私、离线可用**——数据只存在本地浏览器,无需登录。可选填入自己的 DeepSeek API Key 获得 AI 智能解析。

## 技术栈

- **框架:** React 19 + TypeScript
- **构建工具:** Vite 8 + [@crxjs/vite-plugin](https://crxjs.dev/)(MV3)
- **样式:** Tailwind CSS 4(`@theme` token 定义在 `src/index.css`)
- **测试:** Vitest(happy-dom)
- **平台:** Chrome MV3,`minimum_chrome_version` 114,Side Panel API

> 网络请求用原生 `fetch`(Service Worker 无 XHR,故不使用 axios)。

## 功能

| 功能 | 说明 |
|------|------|
| 待办 | 任务清单,分页 + 触底加载 |
| 提醒 | 到点系统通知;后台闹钟触发 |
| 计时 | 经典番茄钟循环(工作/休息、每 4 轮长休息)、暂停/继续/重置、预计结束、悬浮小组件 |
| 剪贴板 | 收藏文字/图片,置顶、搜索;右键「保存图片」,面板内一键「从剪贴板添加」 |
| 一句话添加 | 顶部输入框自然语言添加。默认**本地规则解析**(中英文、离线、零后端)自动分流到提醒/计时/待办;填入自己的 **DeepSeek Key** 后改用 AI 智能解析(失败自动回退本地) |
| 我的 | 右上齿轮进入,切换界面语言、填写 DeepSeek Key、查看已完成待办与历史提醒(本版本无需登录) |

## 解析档位

| 档位 | 触发条件 | 解析方式 | 成本 |
|------|----------|----------|------|
| 免费 | 未填 Key | 本地规则解析(中/英文时间、时长、星期、日期等常见句式) | 零(纯本地) |
| BYOK | 在「我的」填入自己的 DeepSeek Key | 单次 DeepSeek 调用,支持多意图;请求直连 `api.deepseek.com`,不经过我方服务器 | 由用户自付 |

> Key 仅保存在 `chrome.storage.local`,除 DeepSeek 外不外发。AI 调用失败(Key 无效/网络/限流)时自动回退到本地解析并提示。

## 快速开始

```bash
# 安装依赖
npm install

# 启动开发服务器(端口 5174)
npm run dev

# 类型检查
npm run typecheck

# 单元测试
npm run test          # 单次运行
npm run test:watch    # 监听模式

# 构建生产包(输出到 dist/)
npm run build
```

> ⚠️ 开发时**不要**在 dev server 运行期间执行 `npm run build`——它会覆盖 dev 的 `dist/` 并中断热更新。先停 dev,再 build。

### 在 Chrome 中加载

1. `npm run dev`(或 `npm run build`)生成 `dist/`。
2. 打开 `chrome://extensions`,开启「开发者模式」。
3. 「加载已解压的扩展程序」→ 选择 `dist/` 目录。
4. 点工具栏图标打开侧边栏。

## 架构

```
src/
  background/     # Service Worker:chrome.alarms 心跳/提醒/计时闹钟、通知、剪贴板、纯逻辑(可单测)
  panel/          # 侧边栏入口 App、「我的」设置页
  features/       # 业务视图:todo / reminder / timer(含 TimerWidget)/ clipboard、一句话添加
  components/     # 通用组件(Button、TabBar 等)
  shared/         # 数据层、HTTP、本地存储、计时控制
    api/          # 按登录态分流的数据接口(远端 ↔ 本地)
    local/        # chrome.storage.local 的本地实现 + 本地规则解析器(中/英文)
    ai/           # BYOK:DeepSeek 客户端、Key 存储、AI 一句话解析适配器
```

### 本地优先(v1 无需登录)

数据全部保存在 `chrome.storage.local`,无需注册或登录即可使用。各 `shared/api/*` 接口内部仍按 `hasToken()` 分流(**有 token** 走后端 REST,**无 token** 读写本地);本版本未开放登录入口,故实际运行始终走本地。账号云同步属于未来 Pro 能力。

「一句话添加」默认由扩展内的**本地规则解析器**(`src/shared/local/parse.ts` + `parseEn.ts`)完成,支持常见中英文时间/时长/星期/日期句式,不产生任何网络调用。填入自己的 DeepSeek Key 后,改由 `src/shared/ai/` 走一次 DeepSeek 调用做智能解析(可识别更口语化、多意图的表达),失败时自动回退本地。两种档位都通过相同的本地写入器落库,下游逻辑一致。

### 后台调度

- `chrome.alarms` 每分钟心跳,补排/触发到点提醒(`reminder:{id}`)。
- 计时到点触发 `timer:done`:番茄钟会话置为「等待」态并发通知(手动进入下一段),一次性计时直接通知并清空。
- 点击任意通知打开侧边栏。

### 权限与跨域

扩展页面凭 `host_permissions` 直接跨域 `fetch`,无需服务端 CORS。

| 权限 | 用途 |
|------|------|
| `sidePanel` | 侧边栏 UI |
| `alarms` | 提醒 / 计时到点调度 |
| `notifications` | 系统通知 |
| `storage` / `unlimitedStorage` | 本地数据(含剪贴板图片) |
| `contextMenus` | 右键「保存图片」到剪贴板 |
| `clipboardRead` / `clipboardWrite` | 面板内「从剪贴板添加」/「复制」 |
| `host_permissions` | 后端域名(登录时同步,当前 UI 未开放);`api.deepseek.com`(填入 Key 后 AI 解析) |

## 相关

- 后端:见 `../backend`(NestJS,端口 3001)
- Web 版:见 `../frontend`(React SPA)
