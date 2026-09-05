jest.mock('fs/promises', () => ({
  readFile: jest.fn(),
  writeFile: jest.fn(),
  mkdir: jest.fn(),
}));

const fs = require('fs/promises');
const StateStore = require('../../src/core/StateStore');

describe('StateStore', () => {
  let store;

  beforeEach(() => {
    jest.clearAllMocks();
    store = new StateStore();
  });

  describe('get', () => {
    it('returns parsed state from file', async () => {
      fs.readFile.mockResolvedValue(JSON.stringify({ 'drink-water': '2026-09-05T16:00:00Z' }));

      const state = await store.get();

      expect(state).toEqual({ 'drink-water': '2026-09-05T16:00:00Z' });
    });

    it('returns empty object when file does not exist', async () => {
      fs.readFile.mockRejectedValue(new Error('ENOENT'));

      const state = await store.get();

      expect(state).toEqual({});
    });

    it('returns empty object when file contains invalid JSON', async () => {
      fs.readFile.mockResolvedValue('not json');

      const state = await store.get();

      expect(state).toEqual({});
    });

    it('returns empty object when file is empty', async () => {
      fs.readFile.mockResolvedValue('');

      const state = await store.get();

      expect(state).toEqual({});
    });

    it('returns empty object when file contains non-object', async () => {
      fs.readFile.mockResolvedValue('"just a string"');

      const state = await store.get();

      expect(state).toEqual({});
    });
  });

  describe('getNextFireTime', () => {
    it('returns the fire time for an existing reminder', async () => {
      fs.readFile.mockResolvedValue(JSON.stringify({ 'test-id': '2026-09-05T16:00:00Z' }));

      const result = await store.getNextFireTime('test-id');

      expect(result).toBe('2026-09-05T16:00:00Z');
    });

    it('returns null for nonexistent reminder', async () => {
      fs.readFile.mockResolvedValue(JSON.stringify({}));

      const result = await store.getNextFireTime('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('setNextFireTime', () => {
    it('writes the fire time to file', async () => {
      fs.readFile.mockResolvedValue(JSON.stringify({}));
      fs.mkdir.mockResolvedValue();
      fs.writeFile.mockResolvedValue();

      await store.setNextFireTime('test-id', '2026-09-05T16:00:00Z');

      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.any(String),
        JSON.stringify({ 'test-id': '2026-09-05T16:00:00Z' }, null, 4)
      );
    });

    it('preserves existing state', async () => {
      fs.readFile.mockResolvedValue(JSON.stringify({ 'other-id': '2026-09-05T15:00:00Z' }));
      fs.mkdir.mockResolvedValue();
      fs.writeFile.mockResolvedValue();

      await store.setNextFireTime('test-id', '2026-09-05T16:00:00Z');

      const written = JSON.parse(fs.writeFile.mock.calls[0][1]);
      expect(written).toEqual({
        'other-id': '2026-09-05T15:00:00Z',
        'test-id': '2026-09-05T16:00:00Z',
      });
    });

    it('creates directory before writing', async () => {
      fs.readFile.mockResolvedValue(JSON.stringify({}));
      fs.mkdir.mockResolvedValue();
      fs.writeFile.mockResolvedValue();

      await store.setNextFireTime('test-id', '2026-09-05T16:00:00Z');

      expect(fs.mkdir).toHaveBeenCalledWith(expect.any(String), { recursive: true });
    });
  });

  describe('clearNextFireTime', () => {
    it('removes the fire time from state', async () => {
      fs.readFile.mockResolvedValue(JSON.stringify({
        'test-id': '2026-09-05T16:00:00Z',
        'other-id': '2026-09-05T15:00:00Z',
      }));
      fs.mkdir.mockResolvedValue();
      fs.writeFile.mockResolvedValue();

      await store.clearNextFireTime('test-id');

      const written = JSON.parse(fs.writeFile.mock.calls[0][1]);
      expect(written).toEqual({ 'other-id': '2026-09-05T15:00:00Z' });
    });

    it('does not fail when clearing nonexistent reminder', async () => {
      fs.readFile.mockResolvedValue(JSON.stringify({}));
      fs.mkdir.mockResolvedValue();
      fs.writeFile.mockResolvedValue();

      await store.clearNextFireTime('nonexistent');

      expect(fs.writeFile).toHaveBeenCalled();
    });
  });
});
