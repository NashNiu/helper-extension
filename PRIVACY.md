# Privacy Policy — Helper 助手

**Effective date: 2026-07-07**

Helper 助手 ("the Extension") is a browser side‑panel tool for capturing reminders, timers, to‑dos, and clipboard snippets from a single line of text. This policy explains what data the Extension handles and how.

We designed the Extension to be **local‑first**: it works without an account, and by default your data never leaves your browser.

---

## 1. What data we handle

**Content you create.** To‑dos, reminders, timers, and clipboard items you add are stored **locally in your browser** using the browser's storage APIs. This content stays on your device.

**No account is required.** This version of the Extension does not ask you to register or sign in, and does not collect your name, email address, or any personal identifier to use its core features.

**We do not collect analytics.** The Extension does not include third‑party analytics, advertising, or tracking SDKs, and does not build a profile of your browsing.

## 2. Optional account sync (only if you sign in)

The Extension can connect to our own backend service **only if you choose to sign in to an account**. If — and only if — you sign in:

- Your to‑dos and reminders are transmitted to our server so they can be synced across your devices.
- Authentication uses a token stored locally in your browser.
- Data in transit is protected with HTTPS.

If you never sign in, no content is sent to our server and everything remains local to your browser.

## 3. Permissions and why we request them

- **storage / unlimitedStorage** — save your to‑dos, reminders, timers, and clipboard items locally.
- **alarms / notifications** — schedule reminders and timers and show a desktop notification when they are due.
- **sidePanel** — run the app as a browser side panel.
- **contextMenus** — provide a right‑click "save image" option for the clipboard feature.
- **clipboardRead** — used **only when you click the "add from clipboard" button** inside the panel, to read the item you want to save. The Extension does **not** monitor or read your clipboard in the background or on other websites.
- **clipboardWrite** — used when you click "copy" on a saved item, to place it back on your clipboard.
- **host permission (our backend domain)** — used only to sync data when you are signed in (see Section 2).
- **host permission (api.deepseek.com)** — used only when you set your own DeepSeek key, to send your input directly to DeepSeek for parsing.

## 4. AI / text parsing

The free, default experience parses your one-line input entirely on your device using built-in rules — no text is sent anywhere for parsing. If you choose to enter your own DeepSeek API key in settings, your one-line input is sent directly to DeepSeek (api.deepseek.com) for parsing when you add an item; this happens only when a key is set, and the request goes straight to DeepSeek, never through our server. Your key is stored only in your browser's local storage and is never transmitted anywhere except DeepSeek.

## 5. How we use data

We use the data you provide solely to deliver the Extension's features (showing your lists, firing reminders and timers, and — if you sign in — syncing across your devices). We do **not** sell, rent, or share your data with third parties, and we do not use it for advertising.

## 6. Data retention and deletion

- **Local data:** removing the Extension, or clearing the browser's storage for it, deletes your local data.
- **Synced data (if you signed in):** contact us to request deletion of your account and its associated data.

## 7. Children

The Extension is a general‑purpose productivity tool and is not directed to children under 13.

## 8. Changes to this policy

We may update this policy as the Extension evolves (for example, when account sync is introduced more broadly). Material changes will be reflected by updating the effective date above.

## 9. Contact

Questions or data‑deletion requests: **niutengfei123@gmail.com**

---

# 隐私政策 —— Helper 助手

**生效日期:2026-07-07**

Helper 助手(下称"本扩展")是一款浏览器侧边栏工具,用一句话快速创建提醒、计时、待办并收藏剪贴板内容。本政策说明本扩展会处理哪些数据、如何处理。

本扩展采用**本地优先**设计:无需账号即可使用,默认情况下你的数据不会离开你的浏览器。

---

## 1. 我们处理哪些数据

**你创建的内容。** 你添加的待办、提醒、计时和剪贴板条目,均通过浏览器的存储接口**保存在你本地的浏览器中**,内容留在你的设备上。

**无需账号。** 本版本不要求注册或登录,使用核心功能时不收集你的姓名、邮箱或任何个人身份信息。

**不做数据分析。** 本扩展不包含任何第三方分析、广告或追踪组件,也不会记录或分析你的浏览行为。

## 2. 可选的账号同步(仅在你登录时)

**仅当你主动登录账号时**,本扩展才会连接我们自有的后端服务。若你选择登录:

- 你的待办与提醒会传输到我们的服务器,以便在你的多台设备间同步。
- 登录凭证(token)保存在你本地的浏览器中。
- 传输过程通过 HTTPS 加密。

如果你从不登录,任何内容都不会发送到我们的服务器,全部数据仅保留在你本地的浏览器中。

## 3. 权限及用途

- **storage / unlimitedStorage** —— 在本地保存你的待办、提醒、计时和剪贴板条目。
- **alarms / notifications** —— 安排提醒与计时,并在到点时弹出桌面通知。
- **sidePanel** —— 以浏览器侧边栏形式运行本应用。
- **contextMenus** —— 提供右键"保存图片"到剪贴板收藏的功能。
- **clipboardRead** —— **仅在你点击面板内"从剪贴板添加"按钮时**读取你要保存的内容。本扩展**不会**在后台或在其他网站上监听、读取你的剪贴板。
- **clipboardWrite** —— 在你点击已保存条目的"复制"时,把内容写回剪贴板。
- **主机权限(我们的后端域名)** —— 仅在你登录时用于同步数据(见第 2 节)。
- **主机权限(api.deepseek.com)** —— 仅在你填入自己的 DeepSeek Key 时,用于把你的输入直接发送到 DeepSeek 进行解析。

## 4. AI / 文本解析

免费的默认体验会完全在你的设备上用内置规则解析你输入的一句话,不会把文本发送到任何地方。如果你在设置中填入自己的 DeepSeek API Key,则在你添加内容时,你输入的一句话会直接发送到 DeepSeek(api.deepseek.com)进行解析;这只在设置了 Key 时发生,且请求直连 DeepSeek、不经过我方服务器。你的 Key 仅保存在浏览器本地存储中,除 DeepSeek 外不会传输到任何地方。

## 5. 数据用途

我们仅将你提供的数据用于实现本扩展的功能(展示你的清单、触发提醒与计时,以及在你登录时进行多设备同步)。我们**不会**出售、出租你的数据,也不会与第三方共享,更不用于广告。

## 6. 数据保留与删除

- **本地数据:** 卸载本扩展,或清除浏览器为其存储的数据,即可删除你的本地数据。
- **同步数据(若你曾登录):** 可联系我们请求删除你的账号及相关数据。

## 7. 儿童

本扩展是通用效率工具,并非面向 13 岁以下儿童。

## 8. 政策变更

随着本扩展的演进(例如更广泛地引入账号同步),我们可能更新本政策。重大变更将通过更新上方的"生效日期"体现。

## 9. 联系方式

如有疑问或需删除数据,请联系:**niutengfei123@gmail.com**
