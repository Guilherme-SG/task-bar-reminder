const fs = require('fs');
const path = require('path');
const cron = require('node-cron');

const { SECONDS_TO_MS } = require('../utils/constants.js');

const CONFIG_PATH = path.join(__dirname, '..', '..', 'config.json');

const DEFAULTS = {
  ffplayPath: '',
  autoSnoozeTimeout: 60,
  snoozeInterval: 300,
  blockWhenFocused: [],
  window: { width: 320, height: 220, defaultColor: '#1a1a2e' },
};

class ConfigLoader {
  static getDefaults() {
    return {
      ffplayPath: DEFAULTS.ffplayPath,
      autoSnoozeTimeout: DEFAULTS.autoSnoozeTimeout,
      snoozeInterval: DEFAULTS.snoozeInterval,
      blockWhenFocused: [...DEFAULTS.blockWhenFocused],
      window: { ...DEFAULTS.window },
    };
  }

  static load() {
    const raw = ConfigLoader.#readFile();
    const config = ConfigLoader.#applyDefaults(raw);
    ConfigLoader.#validate(config);
    ConfigLoader.#convertToMs(config);
    return config;
  }

  static getSettings(filePath = CONFIG_PATH) {
    const raw = ConfigLoader.#readFile(filePath);
    const merged = ConfigLoader.#applyDefaults(raw);
    return {
      ffplayPath: merged.ffplayPath,
      autoSnoozeTimeout: merged.autoSnoozeTimeout,
      snoozeInterval: merged.snoozeInterval,
      blockWhenFocused: [...merged.blockWhenFocused],
      window: { ...merged.window },
      defaults: ConfigLoader.getDefaults(),
    };
  }

  static saveSettings(newSettings, filePath = CONFIG_PATH) {
    const raw = ConfigLoader.#readFile(filePath);
    const hasInvalidWindow =
      newSettings.window !== undefined &&
      (!newSettings.window || typeof newSettings.window !== 'object' || Array.isArray(newSettings.window));
    const mergedWindow = hasInvalidWindow
      ? newSettings.window
      : { ...DEFAULTS.window, ...raw.window, ...newSettings.window };

    const merged = {
      ...DEFAULTS,
      ...raw,
      ...newSettings,
      window: mergedWindow,
    };

    if (newSettings.blockWhenFocused !== undefined) {
      merged.blockWhenFocused = ConfigLoader.#normalizeStringList(newSettings.blockWhenFocused);
    }

    ConfigLoader.validateSettings(merged);

    const toWrite = {
      ffplayPath: merged.ffplayPath,
      autoSnoozeTimeout: merged.autoSnoozeTimeout,
      snoozeInterval: merged.snoozeInterval,
      blockWhenFocused: merged.blockWhenFocused,
      window: merged.window,
      reminders: raw.reminders || [],
    };
    fs.writeFileSync(filePath, JSON.stringify(toWrite, null, 2), 'utf8');

    return {
      ffplayPath: merged.ffplayPath,
      autoSnoozeTimeout: merged.autoSnoozeTimeout * SECONDS_TO_MS,
      snoozeInterval: merged.snoozeInterval * SECONDS_TO_MS,
      blockWhenFocused: [...merged.blockWhenFocused],
      window: { ...merged.window },
    };
  }

  static resetSettings(filePath = CONFIG_PATH) {
    return ConfigLoader.saveSettings(ConfigLoader.getDefaults(), filePath);
  }

  static #readFile(filePath = CONFIG_PATH) {
    if (!fs.existsSync(filePath)) {
      throw new Error(`Config file not found: ${filePath}`);
    }

    const content = fs.readFileSync(filePath, 'utf8');

    try {
      return JSON.parse(content);
    } catch {
      throw new Error(`Invalid JSON in config file: ${filePath}`);
    }
  }

  static #applyDefaults(raw) {
    const hasInvalidWindow =
      raw.window !== undefined &&
      (!raw.window || typeof raw.window !== 'object' || Array.isArray(raw.window));

    return {
      ...DEFAULTS,
      ...raw,
      window: hasInvalidWindow ? raw.window : { ...DEFAULTS.window, ...raw.window },
    };
  }

  static validateSettings(settings) {
    if (typeof settings.ffplayPath !== 'string') {
      throw new Error('"ffplayPath" must be a string');
    }

    if (typeof settings.autoSnoozeTimeout !== 'number' || Number.isNaN(settings.autoSnoozeTimeout) || settings.autoSnoozeTimeout < 0) {
      throw new Error('"autoSnoozeTimeout" must be a non-negative number');
    }

    if (typeof settings.snoozeInterval !== 'number' || Number.isNaN(settings.snoozeInterval) || settings.snoozeInterval < 0) {
      throw new Error('"snoozeInterval" must be a non-negative number');
    }

    if (!ConfigLoader.#isStringList(settings.blockWhenFocused)) {
      throw new Error('"blockWhenFocused" must be an array of non-empty strings');
    }

    if (!settings.window || typeof settings.window !== 'object' || Array.isArray(settings.window)) {
      throw new Error('"window" must be an object');
    }

    if (typeof settings.window.width !== 'number' || Number.isNaN(settings.window.width) || settings.window.width < 200) {
      throw new Error('"window.width" must be a number >= 200');
    }

    if (typeof settings.window.height !== 'number' || Number.isNaN(settings.window.height) || settings.window.height < 120) {
      throw new Error('"window.height" must be a number >= 120');
    }

    if (settings.window.defaultColor !== undefined && !ConfigLoader.#isValidHex(settings.window.defaultColor)) {
      throw new Error(`Invalid window.defaultColor: "${settings.window.defaultColor}"`);
    }
  }

  static #validate(config) {
    if (!config.reminders || !Array.isArray(config.reminders) || config.reminders.length === 0) {
      throw new Error('Config must contain a "reminders" array with at least one entry');
    }

    const ids = new Set();

    for (const reminder of config.reminders) {
      ConfigLoader.validateReminder(reminder, ids);
      ids.add(reminder.id);
    }

    ConfigLoader.validateSettings(config);
  }

  static generateOneShotId(title = '', existingIds = new Set()) {
    const slug = String(title)
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 24)
      .replace(/-+$/g, '');
    const base = slug ? `oneshot-${slug}-${Date.now()}` : `oneshot-${Date.now()}`;
    let candidate = base;
    let suffix = 2;
    while (existingIds.has(candidate)) {
      candidate = `${base}-${suffix}`;
      suffix += 1;
    }
    return candidate;
  }

  static validateReminder(reminder, existingIds = new Set()) {
    if (!reminder.id || typeof reminder.id !== 'string') {
      throw new Error('Each reminder must have a string "id"');
    }

    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(reminder.id)) {
      throw new Error(`Reminder "id" must be lowercase kebab-case (e.g., "drink-water")`);
    }

    if (existingIds.has(reminder.id)) {
      throw new Error(`Duplicate reminder id: "${reminder.id}"`);
    }

    if (!reminder.title || typeof reminder.title !== 'string') {
      throw new Error(`Reminder "${reminder.id}" must have a string "title"`);
    }

    if (reminder.oneShot !== undefined && typeof reminder.oneShot !== 'boolean') {
      throw new Error(`Reminder "${reminder.id}" oneShot must be a boolean`);
    }

    if (reminder.oneShot) {
      if (typeof reminder.fireAt !== 'string' || Number.isNaN(new Date(reminder.fireAt).getTime())) {
        throw new Error(`One-shot reminder "${reminder.id}" must have a valid ISO "fireAt" timestamp`);
      }
    } else {
      const cronRules = ConfigLoader.#getCronRules(reminder);

      for (const cronExpression of cronRules) {
        if (!cron.validate(cronExpression)) {
          throw new Error(`Reminder "${reminder.id}" has invalid cron expression: "${cronExpression}"`);
        }
      }
    }

    if (reminder.description !== undefined && typeof reminder.description !== 'string') {
      throw new Error(`Reminder "${reminder.id}" description must be a string`);
    }

    if (reminder.color !== undefined && !ConfigLoader.#isValidHex(reminder.color)) {
      throw new Error(`Reminder "${reminder.id}" has invalid color: "${reminder.color}"`);
    }

    if (reminder.snoozeInterval !== undefined && (typeof reminder.snoozeInterval !== 'number' || reminder.snoozeInterval < 0)) {
      throw new Error(`Reminder "${reminder.id}" snoozeInterval must be a non-negative number`);
    }

    if (reminder.autoSnoozeTimeout !== undefined && (typeof reminder.autoSnoozeTimeout !== 'number' || reminder.autoSnoozeTimeout < 0)) {
      throw new Error(`Reminder "${reminder.id}" autoSnoozeTimeout must be a non-negative number`);
    }

    if (reminder.blockWhenFocused !== undefined && !ConfigLoader.#isStringList(reminder.blockWhenFocused)) {
      throw new Error(`Reminder "${reminder.id}" blockWhenFocused must be an array of non-empty strings`);
    }

    if (reminder.useDefaultSound !== undefined && typeof reminder.useDefaultSound !== 'boolean') {
      throw new Error(`Reminder "${reminder.id}" useDefaultSound must be a boolean`);
    }
  }

  static #normalizeStringList(value) {
    if (typeof value === 'string') {
      return value
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
    }
    return value;
  }

  static #normalizeReminder(rawReminder, existingIds) {
    const reminder = { ...rawReminder };
    if (reminder.oneShot === true) {
      if (!reminder.id) {
        reminder.id = ConfigLoader.generateOneShotId(reminder.title, existingIds);
      }
      if (reminder.delaySeconds !== undefined) {
        if (typeof reminder.delaySeconds !== 'number' || Number.isNaN(reminder.delaySeconds) || reminder.delaySeconds <= 0) {
          throw new Error('One-shot reminder "delaySeconds" must be a positive number');
        }
        reminder.fireAt = new Date(Date.now() + reminder.delaySeconds * SECONDS_TO_MS).toISOString();
        delete reminder.delaySeconds;
      }
    }

    if (reminder.blockWhenFocused !== undefined) {
      reminder.blockWhenFocused = ConfigLoader.#normalizeStringList(reminder.blockWhenFocused);
    }

    if (reminder.description === '') delete reminder.description;
    if (reminder.color === '' || reminder.color === null) delete reminder.color;
    if (reminder.blockWhenFocused === null) delete reminder.blockWhenFocused;
    if (reminder.snoozeInterval === '' || reminder.snoozeInterval === null) {
      delete reminder.snoozeInterval;
    }
    if (reminder.autoSnoozeTimeout === '' || reminder.autoSnoozeTimeout === null) {
      delete reminder.autoSnoozeTimeout;
    }

    return reminder;
  }

  static #toRuntimeReminder(reminder) {
    const runtime = { ...reminder };
    if (runtime.snoozeInterval !== undefined) {
      runtime.snoozeInterval *= SECONDS_TO_MS;
    }
    if (runtime.autoSnoozeTimeout !== undefined) {
      runtime.autoSnoozeTimeout *= SECONDS_TO_MS;
    }
    return runtime;
  }

  static saveReminder(newReminder, filePath = CONFIG_PATH) {
    const raw = ConfigLoader.#readFile(filePath);

    if (!raw.reminders || !Array.isArray(raw.reminders)) {
      raw.reminders = [];
    }

    const existingIds = new Set(raw.reminders.map((r) => r.id));
    const reminderToSave = ConfigLoader.#normalizeReminder(newReminder, existingIds);

    ConfigLoader.validateReminder(reminderToSave, existingIds);

    raw.reminders.push(reminderToSave);
    fs.writeFileSync(filePath, JSON.stringify(raw, null, 2), 'utf8');

    return ConfigLoader.#toRuntimeReminder(reminderToSave);
  }

  static updateReminder(id, updatedData, filePath = CONFIG_PATH) {
    const raw = ConfigLoader.#readFile(filePath);

    if (!raw.reminders || !Array.isArray(raw.reminders)) {
      throw new Error(`Reminder with id "${id}" not found`);
    }

    const index = raw.reminders.findIndex((r) => r.id === id);
    if (index === -1) {
      throw new Error(`Reminder with id "${id}" not found`);
    }

    const otherIds = new Set(raw.reminders.filter((r) => r.id !== id).map((r) => r.id));
    const reminderToSave = ConfigLoader.#normalizeReminder({
      ...raw.reminders[index],
      ...updatedData,
      id,
    }, otherIds);

    ConfigLoader.validateReminder(reminderToSave, otherIds);

    raw.reminders[index] = reminderToSave;
    fs.writeFileSync(filePath, JSON.stringify(raw, null, 2), 'utf8');

    return ConfigLoader.#toRuntimeReminder(reminderToSave);
  }

  static deleteReminder(id, filePath = CONFIG_PATH) {
    const raw = ConfigLoader.#readFile(filePath);

    if (!raw.reminders || !Array.isArray(raw.reminders)) {
      throw new Error(`Reminder with id "${id}" not found`);
    }

    const index = raw.reminders.findIndex((r) => r.id === id);
    if (index === -1) {
      throw new Error(`Reminder with id "${id}" not found`);
    }

    raw.reminders.splice(index, 1);
    fs.writeFileSync(filePath, JSON.stringify(raw, null, 2), 'utf8');

    return id;
  }

  static #getCronRules(reminder) {
    const isString = typeof reminder.cron === 'string';
    const isNonEmptyStringArray =
      Array.isArray(reminder.cron) &&
      reminder.cron.length > 0 &&
      reminder.cron.every((expression) => typeof expression === 'string');

    if (!isString && !isNonEmptyStringArray) {
      throw new Error(
        `Reminder "${reminder.id}" must have a string "cron" or a non-empty array of strings`
      );
    }

    return isString ? [reminder.cron] : reminder.cron;
  }

  static #convertToMs(config) {
    config.autoSnoozeTimeout *= SECONDS_TO_MS;
    config.snoozeInterval *= SECONDS_TO_MS;

    for (const reminder of config.reminders) {
      if (reminder.snoozeInterval !== undefined) {
        reminder.snoozeInterval *= SECONDS_TO_MS;
      }
      if (reminder.autoSnoozeTimeout !== undefined) {
        reminder.autoSnoozeTimeout *= SECONDS_TO_MS;
      }
    }
  }

  static #isValidHex(str) {
    return typeof str === 'string' && /^#[0-9a-fA-F]{6}$/.test(str);
  }

  static #isStringList(value) {
    return (
      Array.isArray(value) &&
      value.every((entry) => typeof entry === 'string' && entry.trim().length > 0)
    );
  }
}

module.exports = ConfigLoader;
