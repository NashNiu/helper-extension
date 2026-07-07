# Helper 浏览器扩展

[English](README.en.md)

Chrome 侧边栏(Side Panel)扩展:一句话搞定提醒、计时与待办。**纯本地、隐私、离线可用**——数据只存在本地浏览器。

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
| 一句话添加 | 顶部输入框自然语言添加,**本地规则解析**自动分流到提醒/计时/待办(离线、零后端) |
| 个人中心 | 右上头像进入,查看已完成待办、历史提醒;登录 / 退出 |

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
  background/     # Service Worker:chrome.alarms 心跳/提醒/计时闹钟、通知、纯逻辑(可单测)
  panel/          # 侧边栏入口 App、个人中心、登录
  features/       # 业务视图:todo / reminder / timer(含 TimerWidget)、一句话添加
  components/     # 通用组件(Button、TabBar 等)
  shared/         # 数据层、HTTP、鉴权、本地存储、计时控制
    api/          # 按登录态分流的数据接口(远端 ↔ 本地)
    local/        # chrome.storage.local 的本地实现
```

### 本地优先 + 可选登录

各 `shared/api/*` 接口内部按 `hasToken()` 分流:**已登录**走后端 REST,**未登录**读写 `chrome.storage.local`。调用方无需感知,登录态切换时视图凭 `refreshKey` 重新加载。

未登录时的「一句话添加」由扩展内的**本地规则解析器**(`src/shared/local/parse.ts`)完成,支持常见中文时间/时长句式,不产生任何后端调用。复杂或口语化表达的智能解析属于未来 Pro 能力。

### 后台调度

- `chrome.alarms` 每分钟心跳,补排/触发到点提醒(`reminder:{id}`)。
- 计时到点触发 `timer:done`:番茄钟会话置为「等待」态并发通知(手动进入下一段),一次性计时直接通知并清空。
- 点击任意通知打开侧边栏。

### 权限与跨域

`host_permissions` 覆盖本地(`localhost:3001`)与生产后端,扩展页面凭主机权限直接跨域 `fetch`,无需服务端 CORS。

| 权限 | 用途 |
|------|------|
| `sidePanel` | 侧边栏 UI |
| `alarms` | 提醒 / 计时到点调度 |
| `notifications` | 系统通知 |
| `storage` | 本地数据与登录 token |

## 相关

- 后端:见 `../backend`(NestJS,端口 3001)
- Web 版:见 `../frontend`(React SPA)
