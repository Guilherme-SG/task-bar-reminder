# Desktop Reminder

Desktop reminder app with cron scheduling. Configure reminders via a single JSON file.

## Prerequisites

- **Node.js** >= 18.0.0 ([download](https://nodejs.org/))
- **ffplay.exe** (from FFmpeg) - audio playback required
  - Download from https://ffmpeg.org/download.html
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

2. Edit `config.json` with your settings.

3. Place sound files in the `sounds/` folder following the naming convention.

4. Run the app:
   ```bash
   npm start
   ```
   or double-click `start.vbs` (runs without console window).

## Configuration

Edit `config.json` in the project root:

```json
{
  "ffplayPath": "C:\\ffmpeg\\bin\\ffplay.exe",
  "autoSnoozeTimeout": 60000,
  "snoozeInterval": 300000,
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
      "cron": "*/40 * * * *",
      "color": "#1e3a5f"
    }
  ]
}
```

> **Note:** The config is read once at startup. After editing `config.json`, restart the app to apply changes.

### Fields

| Field | Type | Default | Description |
|---|---|---|---|
| `ffplayPath` | string | `""` | Full path to `ffplay.exe`. Leave empty to skip audio. |
| `autoSnoozeTimeout` | number | `60000` | Ms before auto-dismissing a popup (1 min). |
| `snoozeInterval` | number | `300000` | Ms before retrying after snooze (5 min). |
| `window.width` | number | `320` | Popup window width. |
| `window.height` | number | `220` | Popup window height. |
| `window.defaultColor` | string | `"#1a1a2e"` | Default card color (hex). Used when reminder has no `color`. |
| `reminders` | array | - | List of reminders (required). |

### Reminder Object

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | string | Yes | Unique identifier. Used for sound file matching. |
| `title` | string | Yes | Displayed in the popup header. |
| `description` | string | No | Displayed below the title. |
| `cron` | string | Yes | Cron expression for scheduling. |
| `color` | string | No | Card color as hex (e.g., `"#1e3a5f"`). Uses `window.defaultColor` if not set. |

## Cron Expressions

Standard 5-field cron syntax:

```
*    *    *    *    *
┬    ┬    ┬    ┬    ┬
│    │    │    │    └─ day of week (0-7, 0 or 7 = Sunday)
│    │    │    └────── month (1-12)
│    │    └─────────── day of month (1-31)
│    └──────────────── hour (0-23)
└───────────────────── minute (0-59)
```

Use [crontab.guru](https://crontab.guru/) to build and test your cron expressions interactively.

### Common Examples

| Cron | Description |
|---|---|
| `*/40 * * * *` | Every 40 minutes |
| `0 * * * *` | Every hour, on the hour |
| `0 9,12,15,18 * * *` | At 9:00, 12:00, 15:00, and 18:00 |
| `0 10,14,18 * * 1-5` | At 10:00, 14:00, 18:00 on weekdays |
| `*/15 9-17 * * 1-5` | Every 15 min, 9am-5pm, weekdays |
| `0 8 * * *` | Daily at 8:00 |

## Sound Files

Place MP3 files in the `sounds/` folder at the project root.

### Naming Convention

```
sounds/{id}-{type}-{number}.mp3
```

| Part | Description |
|---|---|
| `{id}` | Reminder ID from config (e.g., `drink-water`) |
| `{type}` | One of: `wake-up`, `done`, `snooze` |
| `{number}` | Sequential number starting at 1 |

### Examples

For reminder `id: "drink-water"`:
```
sounds/drink-water-wake-up-1.mp3
sounds/drink-water-wake-up-2.mp3
sounds/drink-water-done-1.mp3
sounds/drink-water-snooze-1.mp3
```

For reminder `id: "have-break"`:
```
sounds/have-break-wake-up-1.mp3
sounds/have-break-done-1.mp3
sounds/have-break-snooze-1.mp3
```

### How Sounds Work

- **wake-up**: Played when the reminder fires. One random file is picked from available wake-up sounds.
- **done**: Played when user clicks "Feito" (Done). One random file is picked.
- **snooze**: Played when user clicks "Adiar" (Snooze). One random file is picked.

If no sound files are found for a type, that sound is silently skipped (no error).

## Multiple Reminders

You can add as many reminders as needed. Each must have a unique `id`.

```json
{
  "reminders": [
    {
      "id": "drink-water",
      "title": "Drink water",
      "cron": "*/40 * * * *"
    },
    {
      "id": "stretch",
      "title": "Time to stretch",
      "cron": "0 10,14 * * 1-5"
    },
    {
      "id": "meditate",
      "title": "Meditation break",
      "description": "5 minutes of mindfulness",
      "cron": "0 9 * * *"
    }
  ]
}
```

Each reminder runs independently with its own cron schedule and sounds.
