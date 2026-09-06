# AGENTS.md

## Commands

- `yarn test` or `npx jest --coverage` — runs all tests with 100% coverage enforcement
- `npx jest tests/core/ReminderService.test.js` — run a single test suite
- `npx jest --testNamePattern "snooze"` — run tests matching a name pattern
- `yarn start` or `npx electron .` — launch the app

No lint or typecheck configured. Pure JS, no TypeScript.

## Architecture

Electron desktop app (CommonJS, no framework). Single-window popup with system tray.

```
src/
  main.js              — entry point, wires all modules
  core/                — business logic (no Electron deps except main.js)
    ConfigLoader.js    — sync fs, validates config.json, converts seconds→ms
    Scheduler.js       — cron-parser only (node-cron removed from usage)
    ReminderService.js — orchestrator: queue, timers, sound, tray callbacks
    AudioPlayer.js     — spawns ffplay, Promise-based
    StateStore.js      — async fs/promises, persists next-fire-time
  ui/                  — Electron UI
    ReminderWindow.js  — BrowserWindow, stacked cards, recovery watch
    reminder.html      — inline IPC, escapeHtml for XSS protection
    Tray.js            — system tray context menu
  utils/               — shared constants and helpers
    constants.js       — REMINDER_ACTIONS, TIMEOUT_KEY_PREFIX, SECONDS_TO_MS
    colorUtils.js      — hex color parsing, luminance, deriveButtonColors
```

## Key Conventions

- **Config is seconds internally, converted to ms by ConfigLoader.** All config fields (`snoozeInterval`, `autoSnoozeTimeout`) are in seconds in JSON.
- **Cron uses 6-field format** (with seconds as first field). Validated by `node-cron` at load time, parsed by `cron-parser` at runtime.
- **Reminder `id` must be lowercase kebab-case** (`^[a-z0-9]+(?:-[a-z0-9]+)*$`). Used for sound file matching.
- **Sound naming:** `sounds/{id}-{type}-{N}.mp3` where type is `alert`, `done`, or `snooze`.
- **config.json is gitignored.** `config.example.json` is the reference.
- **`window.show()` is used, not `showInactive()`** — required for the window to appear over fullscreen apps.
- **`escapeHtml()` in reminder.html** — title and description are sanitized before innerHTML injection.

## Testing

- 100% coverage enforced globally (statements, branches, functions, lines). Tests will fail if coverage drops.
- Electron is fully mocked in tests — no real windows spawn.
- `jest.useFakeTimers()` is used extensively in ReminderService tests. Use `jest.advanceTimersByTimeAsync()` for async timer flows.
- Test files mirror source: `src/core/X.js` → `tests/core/X.test.js`.

## Gotchas

- `node-cron` is a dependency but only used for `cron.validate()` in ConfigLoader. The actual scheduling uses `setTimeout` + `cron-parser`.
- `BrowserWindow` uses `nodeIntegration: true` and `contextIsolation: false` — this is intentional for the IPC-driven card UI.
- `ReminderWindow` has a recovery watch (2s interval) that re-shows the window if cards exist but the window is hidden.
- `ReminderService.resolveReminder()` plays the action sound then hides the window. It cancels auto-dismiss timers on manual resolve.
- Tray menu rebuilds on every `updateMenu()` call — no diffing.
