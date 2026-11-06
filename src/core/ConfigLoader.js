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
  static load() {
    const raw = ConfigLoader.#readFile();
    const config = ConfigLoader.#applyDefaults(raw);
    ConfigLoader.#validate(config);
    ConfigLoader.#convertToMs(config);
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
      ConfigLoader.validateReminder(reminder, ids);
      ids.add(reminder.id);
    }

    if (config.window.defaultColor !== undefined && !ConfigLoader.#isValidHex(config.window.defaultColor)) {
      throw new Error(`Invalid window.defaultColor: "${config.window.defaultColor}"`);
    }

    if (typeof config.autoSnoozeTimeout !== 'number' || config.autoSnoozeTimeout < 0) {
      throw new Error('"autoSnoozeTimeout" must be a non-negative number');
    }

    if (typeof config.snoozeInterval !== 'number' || config.snoozeInterval < 0) {
      throw new Error('"snoozeInterval" must be a non-negative number');
    }

    if (!ConfigLoader.#isStringList(config.blockWhenFocused)) {
      throw new Error('"blockWhenFocused" must be an array of non-empty strings');
    }
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

    const cronRules = ConfigLoader.#getCronRules(reminder);

    for (const cronExpression of cronRules) {
      if (!cron.validate(cronExpression)) {
        throw new Error(`Reminder "${reminder.id}" has invalid cron expression: "${cronExpression}"`);
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
  }

  static #normalizeReminder(rawReminder) {
    const reminder = { ...rawReminder };
    if (typeof reminder.blockWhenFocused === 'string') {
      reminder.blockWhenFocused = reminder.blockWhenFocused
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
    }

    if (reminder.description === '') delete reminder.description;
    if (reminder.color === '') delete reminder.color;
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
    if (!fs.existsSync(filePath)) {
      throw new Error(`Config file not found: ${filePath}`);
    }

    let raw;
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      raw = JSON.parse(content);
    } catch {
      throw new Error(`Invalid JSON in config file: ${filePath}`);
    }

    if (!raw.reminders || !Array.isArray(raw.reminders)) {
      raw.reminders = [];
    }

    const existingIds = new Set(raw.reminders.map((r) => r.id));
    const reminderToSave = ConfigLoader.#normalizeReminder(newReminder);

    ConfigLoader.validateReminder(reminderToSave, existingIds);

    raw.reminders.push(reminderToSave);
    fs.writeFileSync(filePath, JSON.stringify(raw, null, 2), 'utf8');

    return ConfigLoader.#toRuntimeReminder(reminderToSave);
  }

  static updateReminder(id, updatedData, filePath = CONFIG_PATH) {
    if (!fs.existsSync(filePath)) {
      throw new Error(`Config file not found: ${filePath}`);
    }

    let raw;
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      raw = JSON.parse(content);
    } catch {
      throw new Error(`Invalid JSON in config file: ${filePath}`);
    }

    if (!raw.reminders || !Array.isArray(raw.reminders)) {
      throw new Error(`Reminder with id "${id}" not found`);
    }

    const index = raw.reminders.findIndex((r) => r.id === id);
    if (index === -1) {
      throw new Error(`Reminder with id "${id}" not found`);
    }

    const reminderToSave = ConfigLoader.#normalizeReminder({
      ...raw.reminders[index],
      ...updatedData,
      id,
    });

    const otherIds = new Set(raw.reminders.filter((r) => r.id !== id).map((r) => r.id));
    ConfigLoader.validateReminder(reminderToSave, otherIds);

    raw.reminders[index] = reminderToSave;
    fs.writeFileSync(filePath, JSON.stringify(raw, null, 2), 'utf8');

    return ConfigLoader.#toRuntimeReminder(reminderToSave);
  }

  static deleteReminder(id, filePath = CONFIG_PATH) {
    if (!fs.existsSync(filePath)) {
      throw new Error(`Config file not found: ${filePath}`);
    }

    let raw;
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      raw = JSON.parse(content);
    } catch {
      throw new Error(`Invalid JSON in config file: ${filePath}`);
    }

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
