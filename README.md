# Desktop Reminder

Desktop reminder app with cron scheduling. Configure reminders via a single JSON file.

## Prerequisites

- **Node.js** >= 18.0.0 ([download](https://nodejs.org/))
- **ffplay.exe** (from FFmpeg) - audio playback required
  - Download from https://ffmpeg.org/download.html 
    - For windows go to https://www.gyan.dev/ffmpeg/builds/ or click [here](https://www.gyan.dev/ffmpeg/builds/ffmpeg-git-essentials.7z)
  - Extract and note the path to `ffplay.exe`

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```
   or
   ```bash
   yarn install
   ```

2. Copy `config.example.json` to `config.json` and edit with your settings:
   ```bash
   copy config.example.json config.json
   ```

3. Place sound files in the `sounds/` folder following the naming convention.

4. Run the app:
   ```bash
   npm start
   ```
   or double-click `start.vbs` (runs without console window).

## Configuration

Copy `config.example.json` to `config.json` and customize it. See `config.example.json` for a complete working example.

```json
{
  "ffplayPath": "C:\\ffmpeg\\bin\\ffplay.exe",
  "autoSnoozeTimeout": 60,
  "snoozeInterval": 300,
  "blockWhenFocused": ["dota2", "eldenring"],
  "window": {
    "width": 320,
    "height": 220,
    "defaultColor": "#1a1a2e"
  },
  "reminders": [
    {
      "id": "drink-water",
      "title": "Hora de beber água",
      "description": "Meia garrafa/350ml recomendados",
      "cron": [
        "0 0,40 0-23/2 * * *",
        "0 20 1-23/2 * * *"
      ],
      "color": "#1e3a5f"
    }
  ]
}
```

> **Note:** The config is read once at startup. After editing `config.json`, use the **Restart** button in the system tray to apply changes.

### Fields

| Field | Type | Default | Description |
|---|---|---|---|
| `ffplayPath` | string | `""` | Full path to `ffplay.exe`. Leave empty to skip audio. |
| `autoSnoozeTimeout` | number | `60` | Seconds before auto-dismissing a popup (1 min). |
| `snoozeInterval` | number | `300` | Seconds before retrying after snooze (5 min). |
| `blockWhenFocused` | array of strings | `[]` | Process names that defer popups while focused (Windows only). See [Focus Blocking](#focus-blocking). |
| `window.width` | number | `320` | Popup window width. |
| `window.height` | number | `220` | Popup window height. |
| `window.defaultColor` | string | `"#1a1a2e"` | Default card color (hex). Used when reminder has no `color`. |
| `reminders` | array | - | List of reminders (required). |

### Reminder Object

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | string | Yes | Unique identifier in lowercase kebab-case (e.g., `"drink-water"`). Used for sound file matching. |
| `title` | string | Yes | Displayed in the popup header. |
| `description` | string | No | Displayed below the title. |
| `cron` | string or array of strings | Yes | One cron expression, or an array of expressions. When an array is used, the reminder fires at the earliest matching time across all rules. See [Cron Expressions](#cron-expressions). |
| `color` | string | No | Card color as hex (e.g., `"#1e3a5f"`). Uses `window.defaultColor` if not set. Button colors and text color are automatically derived from this value. |
| `snoozeInterval` | number | No | Seconds before retrying after snooze. Overrides global `snoozeInterval`. |
| `autoSnoozeTimeout` | number | No | Seconds before auto-dismissing the popup. Overrides global `autoSnoozeTimeout`. Set to `0` to disable. |
| `blockWhenFocused` | array of strings | No | Overrides the global `blockWhenFocused` for this reminder. `[]` always shows this reminder, even while a blocked app is focused. |

## Cron Expressions

Both standard 5-field and 6-field (seconds first) syntax are accepted. The 6-field form is:

```
*    *    *    *    *    *
┬    ┬    ┬    ┬    ┬    ┬
│    │    │    │    │    └─ day of week (0-7, 0 or 7 = Sunday)
│    │    │    │    └────── month (1-12)
│    │    │    └─────────── day of month (1-31)
│    │    └──────────────── hour (0-23)
│    └───────────────────── minute (0-59)
└────────────────────────── second (0-59)
```

Use [freetool.dev](https://www.freetool.dev/crontab-generator/) to build and test your cron expressions interactively.

### Cron steps are not rolling intervals

Cron steps match fixed values inside each field. `*/40` in the minute field means "minutes 0 and 40 of every hour", not "every 40 minutes elapsed". Because 40 does not divide 60 evenly, the gaps alternate:

```
10:00 -> 10:40 -> 11:00 -> 11:40 -> 12:00
      40 min    20 min    40 min    20 min
```

The 6-field form `0 */40 * * * *` behaves the same; the first field only sets seconds to `0`.

A single cron expression cannot represent a rolling 40-minute interval. Use one of these options:

- Use a step that divides 60 evenly, such as `*/15`, `*/20`, or `*/30`.
- Use `0,40` if an alert at `:00` and `:40` each hour is acceptable.
- Group multiple rules in one reminder (below) for an exact 40-minute cadence.

### Grouping multiple cron rules

Set `cron` to an array to combine rules. The reminder fires at the earliest upcoming time from any rule and still uses one `id`, one popup, and one set of sound files:

```json
{
  "id": "drink-water",
  "title": "Drink water",
  "cron": [
    "0 0,40 0-23/2 * * *",
    "0 20 1-23/2 * * *"
  ]
}
```

The first rule fires at `:00` and `:40` during even hours; the second fires at `:20` during odd hours. Together they produce an exact 40-minute cadence — `10:00 -> 10:40 -> 11:20 -> 12:00 -> 12:40...` — without duplicating the reminder or its sound files. Every expression must be valid and the array must not be empty.

### Common Examples

| Cron | Description |
|---|---|
| `0 */20 * * * *` | Every 20 minutes |
| `0 */30 * * * *` | Every 30 minutes |
| `0 */40 * * * *` | At :00 and :40 of every hour (40-minute gap, then 20-minute gap; not every 40 minutes) |
| `0 0 * * * *` | Every hour, on the hour |
| `0 0 9,12,15,18 * * *` | At 9:00, 12:00, 15:00, and 18:00 |
| `0 0 10,14,18 * * 1-5` | At 10:00, 14:00, 18:00 on weekdays |
| `0 */15 9-17 * * 1-5` | Every 15 min, 9am-5pm, weekdays |
| `0 0 8 * * *` | Daily at 8:00 |

## Sound Files

Place MP3 files in the `sounds/` folder at the project root.

### Naming Convention

```
sounds/{id}-{type}-{number}.mp3
```

| Part | Description |
|---|---|
| `{id}` | Reminder ID from config (e.g., `drink-water`) |
| `{type}` | One of: `alert`, `done`, `snooze` |
| `{number}` | Sequential number starting at 1 |

### Examples

For reminder `id: "drink-water"`:
```
sounds/drink-water-alert-1.mp3
sounds/drink-water-alert-2.mp3
sounds/drink-water-done-1.mp3
sounds/drink-water-snooze-1.mp3
```

For reminder `id: "have-break"`:
```
sounds/have-break-alert-1.mp3
sounds/have-break-done-1.mp3
sounds/have-break-snooze-1.mp3
```

### How Sounds Work

- **alert**: Played when the reminder fires. One random file is picked from available alert sounds.
- **done**: Played when user clicks "Done". One random file is picked.
- **snooze**: Played when user clicks "Snooze". One random file is picked.

If no sound files are found for a type, that sound is silently skipped (no error).

## Multiple Reminders

You can add as many reminders as needed. Each must have a unique `id`.

```json
{
  "reminders": [
    {
      "id": "drink-water",
      "title": "Drink water",
      "cron": "0 */20 * * * *"
    },
    {
      "id": "stretch",
      "title": "Time to stretch",
      "cron": "0 0 10,14 * * 1-5"
    },
    {
      "id": "meditate",
      "title": "Meditation break",
      "description": "5 minutes of mindfulness",
      "cron": "0 0 9 * * *"
    }
  ]
}
```

Each reminder runs independently with its own cron schedule and sounds. A single reminder can also combine multiple rules by setting `cron` to an array (see [Grouping multiple cron rules](#grouping-multiple-cron-rules)).

Each reminder can also override the global `snoozeInterval` and `autoSnoozeTimeout`:

```json
{
  "id": "drink-water",
  "title": "Drink water",
  "cron": "0 */20 * * * *",
  "snoozeInterval": 120,
  "autoSnoozeTimeout": 30
}
```

## Focus Blocking

You can defer popups while a game (or any other app) is focused, without losing the alert sound. Add the app's process name to `blockWhenFocused`:

```json
{
  "blockWhenFocused": ["dota2", "DarkSoulsIII"],
  "reminders": [
    {
      "id": "drink-water",
      "title": "Drink water",
      "cron": "0 */20 * * * *"
    }
  ]
}
```

How it works:

- Every scheduled alert still plays its sound, even while a blocked app is focused.
- The popup is deferred, not discarded. It appears when the blocked app loses focus.
- If the reminder fires again while it is still deferred, only one popup is kept. The sound still plays for each occurrence.
- The sound is not replayed when the deferred popup appears.
- The auto-dismiss countdown starts when the popup appears, not while it is deferred.
- Pending reminders appear in the tray menu marked `(pending)`, where Done/Snooze still work.
- Deferred reminders are not persisted across app restarts.

Matching is by **process name only**, case-insensitive, and the `.exe` suffix is optional: `dota2`, `dota2.exe`, and `DOTA2` all match. Common examples: Dota 2 → `dota2`, Dark Souls III → `DarkSoulsIII`, Elden Ring → `eldenring`. To find an app's process name, open Task Manager → **Details** and look at the **Name** column (ignore the `.exe` suffix).

A reminder can override the global list. Use `[]` to always show that reminder:

```json
{
  "id": "important",
  "title": "Important reminder",
  "cron": "0 0 9 * * *",
  "blockWhenFocused": []
}
```

> **Notes:** This feature is Windows-only; on other platforms popups always show. While the app is running with a non-empty block list, a hidden PowerShell helper monitors the foreground process (roughly once per second). If foreground detection fails, popups fail open and show normally.

## System Tray

The app runs in the system tray. Right-click the tray icon to access the menu:

| Item | Description |
|---|---|
| **Done - "{title}"** | Dismisses the reminder (shown when active or pending). |
| **Snooze - "{title}"** | Snoozes the reminder for `snoozeInterval` seconds (shown when active or pending). Deferred items are marked `(pending)`. |
| **Restart** | Restarts the app to reload `config.json`. |
| **Exit** | Quits the application. |
