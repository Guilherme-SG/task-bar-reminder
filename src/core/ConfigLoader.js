const fs = require('fs');
const path = require('path');
const cron = require('node-cron');

const CONFIG_PATH = path.join(__dirname, '..', '..', 'config.json');

const DEFAULTS = {
  ffplayPath: '',
  autoSnoozeTimeout: 60000,
  snoozeInterval: 300000,
  window: { width: 320, height: 220 },
};

class ConfigLoader {
  static load() {
    const raw = ConfigLoader.#readFile();
    const config = ConfigLoader.#applyDefaults(raw);
    ConfigLoader.#validate(config);
    return config;
  }

  static #readFile() {
    if (!fs.existsSync(CONFIG_PATH)) {
      throw new Error(`Config file not found: ${CONFIG_PATH}`);
    }

    const content = fs.readFileSync(CONFIG_PATH, 'utf8');

    try {
      return JSON.parse(content);
    } catch {
      throw new Error(`Invalid JSON in config file: ${CONFIG_PATH}`);
    }
  }

  static #applyDefaults(raw) {
    return {
      ...DEFAULTS,
      ...raw,
      window: { ...DEFAULTS.window, ...raw.window },
    };
  }

  static #validate(config) {
    if (!config.reminders || !Array.isArray(config.reminders) || config.reminders.length === 0) {
      throw new Error('Config must contain a "reminders" array with at least one entry');
    }

    const ids = new Set();

    for (const reminder of config.reminders) {
      if (!reminder.id || typeof reminder.id !== 'string') {
        throw new Error('Each reminder must have a string "id"');
      }

      if (ids.has(reminder.id)) {
        throw new Error(`Duplicate reminder id: "${reminder.id}"`);
      }
      ids.add(reminder.id);

      if (!reminder.title || typeof reminder.title !== 'string') {
        throw new Error(`Reminder "${reminder.id}" must have a string "title"`);
      }

      if (!reminder.cron || typeof reminder.cron !== 'string') {
        throw new Error(`Reminder "${reminder.id}" must have a string "cron"`);
      }

      if (!cron.validate(reminder.cron)) {
        throw new Error(`Reminder "${reminder.id}" has invalid cron expression: "${reminder.cron}"`);
      }

      if (reminder.description !== undefined && typeof reminder.description !== 'string') {
        throw new Error(`Reminder "${reminder.id}" description must be a string`);
      }
    }

    if (typeof config.autoSnoozeTimeout !== 'number' || config.autoSnoozeTimeout < 0) {
      throw new Error('"autoSnoozeTimeout" must be a non-negative number');
    }

    if (typeof config.snoozeInterval !== 'number' || config.snoozeInterval < 0) {
      throw new Error('"snoozeInterval" must be a non-negative number');
    }
  }
}

module.exports = ConfigLoader;
