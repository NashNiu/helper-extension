# 记得 (Remind) Browser Extension

[中文](README.md)

A Chrome Side Panel extension: capture reminders, timers, todos, and clipboard snippets in one sentence. **Local-first, private, works offline** — all data stays in your browser, no account required. Optionally paste your own DeepSeek API key for AI-powered parsing.

## Tech Stack

- **Framework:** React 19 + TypeScript
- **Build Tool:** Vite 8 + [@crxjs/vite-plugin](https://crxjs.dev/) (MV3)
- **Styling:** Tailwind CSS 4 (`@theme` tokens defined in `src/index.css`)
- **Testing:** Vitest (happy-dom)
- **Platform:** Chrome MV3, `minimum_chrome_version` 114, Side Panel API

> Network requests use native `fetch` (the Service Worker has no XHR, so axios is not used).

## Features

| Feature | Description |
|---------|-------------|
| Todo | Task list with pagination + infinite scroll |
| Reminders | System notification on due; fired by background alarms |
| Timer | Classic pomodoro cycles (work/break, long break every 4th), pause/resume/reset, estimated end, floating widget |
| Clipboard | Save text/images, pin & search; right-click "save image", one-click "add from clipboard" in the panel |
| Quick add | Natural-language input in the top bar. Default **local rule-based parsing** (Chinese + English, offline, zero backend) auto-routes to reminder / timer / todo; with your own **DeepSeek key** it switches to AI parsing (auto-falls back to local on failure) |
| Mine | Open via the top-right gear to switch UI language, set your DeepSeek key, and view completed todos & past reminders (no login in this version) |

## Parsing tiers

| Tier | Trigger | How it parses | Cost |
|------|---------|---------------|------|
| Free | No key set | Local rule-based parsing (common Chinese/English time, duration, weekday, date expressions) | Zero (fully local) |
| BYOK | Set your own DeepSeek key in "Mine" | A single DeepSeek call, multi-intent; request goes straight to `api.deepseek.com`, never through our server | Paid by you |

> The key is stored only in `chrome.storage.local` and is never sent anywhere except DeepSeek. On AI failure (invalid key / network / rate limit) it silently falls back to local parsing with a note.

## Getting Started

```bash
# Install dependencies
npm install

# Start dev server (port 5174)
npm run dev

# Type check
npm run typecheck

# Unit tests
npm run test          # single run
npm run test:watch    # watch mode

# Production build (outputs to dist/)
npm run build
```

> ⚠️ Do **not** run `npm run build` while the dev server is running — it overwrites the dev `dist/` and breaks HMR. Stop dev first, then build.

### Load in Chrome

1. Run `npm run dev` (or `npm run build`) to produce `dist/`.
2. Open `chrome://extensions` and enable "Developer mode".
3. "Load unpacked" → select the `dist/` directory.
4. Click the toolbar icon to open the side panel.

## Architecture

```
src/
  background/     # Service worker: chrome.alarms heartbeat/reminder/timer alarms, notifications, clipboard, pure logic (unit-tested)
  panel/          # Side panel entry App, "Mine" settings page
  features/       # Feature views: todo / reminder / timer (incl. TimerWidget) / clipboard, quick add
  components/     # Shared components (Button, TabBar, etc.)
  shared/         # Data layer, HTTP, local storage, timer control
    api/          # Login-aware data APIs (remote ↔ local)
    local/        # chrome.storage.local implementations + local rule-based parser (Chinese/English)
    ai/           # BYOK: DeepSeek client, key storage, AI quick-add adapter
```

### Local-first (no login in v1)

All data lives in `chrome.storage.local`; the extension is fully usable without registration or sign-in. Each `shared/api/*` module still branches internally on `hasToken()` (**with a token** → backend REST, **without** → local read/write); this version exposes no login entry point, so it always runs local. Account-based cloud sync is a planned Pro capability.

Quick-add parsing is done by the extension's embedded **local rule-based parser** (`src/shared/local/parse.ts` + `parseEn.ts`), supporting common Chinese/English time, duration, weekday, and date expressions with zero network calls. With your own DeepSeek key set, `src/shared/ai/` performs one DeepSeek call for smarter parsing (handling more colloquial, multi-intent phrasing), falling back to local on failure. Both tiers persist through the same local writers, so downstream logic is identical.

### Background scheduling

- `chrome.alarms` heartbeat every minute re-schedules/fires due reminders (`reminder:{id}`).
- The timer alarm `timer:done` fires: a pomodoro session enters an "awaiting" state and notifies (manual advance to the next phase); a one-shot timer notifies and clears.
- Clicking any notification opens the side panel.

### Permissions & cross-origin

Extension pages `fetch` cross-origin directly via `host_permissions`, so no server-side CORS is needed.

| Permission | Purpose |
|------------|---------|
| `sidePanel` | Side panel UI |
| `alarms` | Reminder / timer scheduling |
| `notifications` | System notifications |
| `storage` / `unlimitedStorage` | Local data (incl. clipboard images) |
| `contextMenus` | Right-click "save image" to clipboard |
| `clipboardRead` / `clipboardWrite` | "Add from clipboard" / "copy" inside the panel |
| `host_permissions` | Backend domain (sync when signed in; not exposed in the current UI); `api.deepseek.com` (AI parsing once a key is set) |

## Related

- Backend: see `../backend` (NestJS, port 3001)
- Web app: see `../frontend` (React SPA)
