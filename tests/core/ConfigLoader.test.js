const fs = require('fs');
const cron = require('node-cron');

jest.mock('fs');
jest.mock('node-cron');

const ConfigLoader = require('../../src/core/ConfigLoader');

const validConfig = {
  reminders: [
    { id: 'test', title: 'Test', cron: '*/40 * * * *' },
  ],
};

function writeConfig(obj) {
  fs.existsSync.mockReturnValue(true);
  fs.readFileSync.mockReturnValue(JSON.stringify(obj));
}

describe('ConfigLoader', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    cron.validate.mockReturnValue(true);
  });

  describe('load', () => {
    it('loads a valid config with defaults', () => {
      writeConfig(validConfig);

      const config = ConfigLoader.load();

      expect(config.reminders).toHaveLength(1);
      expect(config.ffplayPath).toBe('');
      expect(config.autoSnoozeTimeout).toBe(60000);
      expect(config.snoozeInterval).toBe(300000);
      expect(config.window).toEqual({ width: 320, height: 220, defaultColor: '#1a1a2e' });
    });

    it('preserves user-provided values', () => {
      writeConfig({
        ffplayPath: '/custom/path',
        autoSnoozeTimeout: 5000,
        snoozeInterval: 10000,
        window: { width: 400, height: 300 },
        reminders: [{ id: 'a', title: 'A', cron: '0 * * * *' }],
      });

      const config = ConfigLoader.load();

      expect(config.ffplayPath).toBe('/custom/path');
      expect(config.autoSnoozeTimeout).toBe(5000);
      expect(config.snoozeInterval).toBe(10000);
      expect(config.window).toEqual({ width: 400, height: 300, defaultColor: '#1a1a2e' });
    });

    it('merges window defaults with partial user values', () => {
      writeConfig({
        window: { width: 500 },
        reminders: [{ id: 'a', title: 'A', cron: '0 * * * *' }],
      });

      const config = ConfigLoader.load();

      expect(config.window).toEqual({ width: 500, height: 220, defaultColor: '#1a1a2e' });
    });

    it('throws when config file does not exist', () => {
      fs.existsSync.mockReturnValue(false);

      expect(() => ConfigLoader.load()).toThrow('Config file not found');
    });

    it('throws when config file contains invalid JSON', () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue('not json {{{');

      expect(() => ConfigLoader.load()).toThrow('Invalid JSON in config file');
    });

    it('throws when reminders is missing', () => {
      writeConfig({});

      expect(() => ConfigLoader.load()).toThrow('reminders');
    });

    it('throws when reminders is not an array', () => {
      writeConfig({ reminders: 'not-array' });

      expect(() => ConfigLoader.load()).toThrow('reminders');
    });

    it('throws when reminders is empty', () => {
      writeConfig({ reminders: [] });

      expect(() => ConfigLoader.load()).toThrow('reminders');
    });

    it('throws when reminder has no id', () => {
      writeConfig({ reminders: [{ title: 'A', cron: '0 * * * *' }] });

      expect(() => ConfigLoader.load()).toThrow('string "id"');
    });

    it('throws when reminder id is not a string', () => {
      writeConfig({ reminders: [{ id: 123, title: 'A', cron: '0 * * * *' }] });

      expect(() => ConfigLoader.load()).toThrow('string "id"');
    });

    it('throws on duplicate reminder ids', () => {
      writeConfig({
        reminders: [
          { id: 'a', title: 'A', cron: '0 * * * *' },
          { id: 'a', title: 'B', cron: '0 * * * *' },
        ],
      });

      expect(() => ConfigLoader.load()).toThrow('Duplicate reminder id');
    });

    it('throws when reminder has no title', () => {
      writeConfig({ reminders: [{ id: 'a', cron: '0 * * * *' }] });

      expect(() => ConfigLoader.load()).toThrow('string "title"');
    });

    it('throws when reminder title is not a string', () => {
      writeConfig({ reminders: [{ id: 'a', title: 123, cron: '0 * * * *' }] });

      expect(() => ConfigLoader.load()).toThrow('string "title"');
    });

    it('throws when reminder has no cron', () => {
      writeConfig({ reminders: [{ id: 'a', title: 'A' }] });

      expect(() => ConfigLoader.load()).toThrow('string "cron"');
    });

    it('throws when reminder cron is not a string', () => {
      writeConfig({ reminders: [{ id: 'a', title: 'A', cron: 123 }] });

      expect(() => ConfigLoader.load()).toThrow('string "cron"');
    });

    it('throws when reminder cron is invalid', () => {
      cron.validate.mockReturnValue(false);
      writeConfig({ reminders: [{ id: 'a', title: 'A', cron: 'invalid' }] });

      expect(() => ConfigLoader.load()).toThrow('invalid cron expression');
    });

    it('throws when description is not a string', () => {
      writeConfig({
        reminders: [{ id: 'a', title: 'A', cron: '0 * * * *', description: 123 }],
      });

      expect(() => ConfigLoader.load()).toThrow('description must be a string');
    });

    it('accepts reminder with no description', () => {
      writeConfig({ reminders: [{ id: 'a', title: 'A', cron: '0 * * * *' }] });

      const config = ConfigLoader.load();

      expect(config.reminders[0].description).toBeUndefined();
    });

    it('accepts valid description', () => {
      writeConfig({
        reminders: [{ id: 'a', title: 'A', cron: '0 * * * *', description: 'hello' }],
      });

      const config = ConfigLoader.load();

      expect(config.reminders[0].description).toBe('hello');
    });

    it('throws when autoSnoozeTimeout is not a number', () => {
      writeConfig({
        autoSnoozeTimeout: 'bad',
        reminders: [{ id: 'a', title: 'A', cron: '0 * * * *' }],
      });

      expect(() => ConfigLoader.load()).toThrow('autoSnoozeTimeout');
    });

    it('throws when autoSnoozeTimeout is negative', () => {
      writeConfig({
        autoSnoozeTimeout: -1,
        reminders: [{ id: 'a', title: 'A', cron: '0 * * * *' }],
      });

      expect(() => ConfigLoader.load()).toThrow('autoSnoozeTimeout');
    });

    it('throws when snoozeInterval is not a number', () => {
      writeConfig({
        snoozeInterval: 'bad',
        reminders: [{ id: 'a', title: 'A', cron: '0 * * * *' }],
      });

      expect(() => ConfigLoader.load()).toThrow('snoozeInterval');
    });

    it('throws when snoozeInterval is negative', () => {
      writeConfig({
        snoozeInterval: -1,
        reminders: [{ id: 'a', title: 'A', cron: '0 * * * *' }],
      });

      expect(() => ConfigLoader.load()).toThrow('snoozeInterval');
    });

    it('accepts autoSnoozeTimeout of 0', () => {
      writeConfig({
        autoSnoozeTimeout: 0,
        reminders: [{ id: 'a', title: 'A', cron: '0 * * * *' }],
      });

      expect(() => ConfigLoader.load()).not.toThrow();
    });

    it('accepts snoozeInterval of 0', () => {
      writeConfig({
        snoozeInterval: 0,
        reminders: [{ id: 'a', title: 'A', cron: '0 * * * *' }],
      });

      expect(() => ConfigLoader.load()).not.toThrow();
    });

    it('accepts valid hex color on reminder', () => {
      writeConfig({
        reminders: [{ id: 'a', title: 'A', cron: '0 * * * *', color: '#1e3a5f' }],
      });

      const config = ConfigLoader.load();
      expect(config.reminders[0].color).toBe('#1e3a5f');
    });

    it('accepts uppercase hex color', () => {
      writeConfig({
        reminders: [{ id: 'a', title: 'A', cron: '0 * * * *', color: '#FF5733' }],
      });

      expect(() => ConfigLoader.load()).not.toThrow();
    });

    it('accepts reminder without color', () => {
      writeConfig({
        reminders: [{ id: 'a', title: 'A', cron: '0 * * * *' }],
      });

      const config = ConfigLoader.load();
      expect(config.reminders[0].color).toBeUndefined();
    });

    it('throws when reminder color is invalid hex', () => {
      writeConfig({
        reminders: [{ id: 'a', title: 'A', cron: '0 * * * *', color: 'not-hex' }],
      });

      expect(() => ConfigLoader.load()).toThrow('invalid color');
    });

    it('throws when reminder color is short hex', () => {
      writeConfig({
        reminders: [{ id: 'a', title: 'A', cron: '0 * * * *', color: '#fff' }],
      });

      expect(() => ConfigLoader.load()).toThrow('invalid color');
    });

    it('throws when reminder color is missing hash', () => {
      writeConfig({
        reminders: [{ id: 'a', title: 'A', cron: '0 * * * *', color: '1e3a5f' }],
      });

      expect(() => ConfigLoader.load()).toThrow('invalid color');
    });

    it('accepts valid window.defaultColor', () => {
      writeConfig({
        window: { defaultColor: '#aabbcc' },
        reminders: [{ id: 'a', title: 'A', cron: '0 * * * *' }],
      });

      const config = ConfigLoader.load();
      expect(config.window.defaultColor).toBe('#aabbcc');
    });

    it('throws when window.defaultColor is invalid hex', () => {
      writeConfig({
        window: { defaultColor: 'bad' },
        reminders: [{ id: 'a', title: 'A', cron: '0 * * * *' }],
      });

      expect(() => ConfigLoader.load()).toThrow('Invalid window.defaultColor');
    });

    it('accepts window without defaultColor', () => {
      writeConfig({
        window: { width: 400 },
        reminders: [{ id: 'a', title: 'A', cron: '0 * * * *' }],
      });

      const config = ConfigLoader.load();
      expect(config.window.defaultColor).toBe('#1a1a2e');
    });
  });
});
