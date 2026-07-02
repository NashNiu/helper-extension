# Helper Browser Extension

[中文](README.md)

A Chrome Side Panel extension: capture reminders, timers, and todos in one sentence. **Works without login** — data is stored locally; sign in to sync with your account.

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
| Quick add | Natural-language input in the top bar, auto-routed to reminder / timer / todo |
| Profile | Open via the top-right avatar to view completed todos & past reminders; sign in / out |

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
  background/     # Service worker: chrome.alarms heartbeat/reminder/timer alarms, notifications, pure logic (unit-tested)
  panel/          # Side panel entry App, profile, login
  features/       # Feature views: todo / reminder / timer (incl. TimerWidget), quick add
  components/     # Shared components (Button, TabBar, etc.)
  shared/         # Data layer, HTTP, auth, local storage, timer control
    api/          # Login-aware data APIs (remote ↔ local)
    local/        # chrome.storage.local implementations
```

### Local-first + optional login

Each `shared/api/*` module branches internally on `hasToken()`: **logged in** hits the backend REST API, **logged out** reads/writes `chrome.storage.local`. Call sites are unaware; views reload via `refreshKey` when the auth state changes.

While logged out, quick-add uses rate-limited **anonymous** backend endpoints (`/api/public/*`) for AI parsing, so the AI key always stays server-side.

### Background scheduling

- `chrome.alarms` heartbeat every minute re-schedules/fires due reminders (`reminder:{id}`).
- The timer alarm `timer:done` fires: a pomodoro session enters an "awaiting" state and notifies (manual advance to the next phase); a one-shot timer notifies and clears.
- Clicking any notification opens the side panel.

### Permissions & cross-origin

`host_permissions` cover local (`localhost:3001`) and the production backend; extension pages `fetch` cross-origin directly via host permission, so no server-side CORS is needed.

| Permission | Purpose |
|------------|---------|
| `sidePanel` | Side panel UI |
| `alarms` | Reminder / timer scheduling |
| `notifications` | System notifications |
| `storage` | Local data & auth token |

## Related

- Backend: see `../backend` (NestJS, port 3001)
- Web app: see `../frontend` (React SPA)
