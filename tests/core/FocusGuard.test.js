const { EventEmitter } = require('events');
const { PassThrough } = require('stream');
const { spawn } = require('child_process');

const FocusGuard = require('../../src/core/FocusGuard');

function createFakeWatcher() {
  const watcher = new EventEmitter();
  watcher.stdout = new PassThrough();
  watcher.kill = jest.fn();
  return watcher;
}

function flushStream() {
  return new Promise((resolve) => setImmediate(resolve));
}

describe('FocusGuard', () => {
  let watcher;
  let spawnProcess;

  function createGuard(overrides = {}) {
    return new FocusGuard({
      platform: 'win32',
      spawnProcess,
      execPath: 'C:\\apps\\electron.exe',
      ...overrides,
    });
  }

  beforeEach(() => {
    watcher = createFakeWatcher();
    spawnProcess = jest.fn(() => watcher);
  });

  describe('constructor', () => {
    it('defaults to the current platform, spawn, and exec path', () => {
      const guard = new FocusGuard();

      expect(guard.platform).toBe(process.platform);
      expect(guard.spawnProcess).toBe(spawn);
      expect(guard.watcher).toBeNull();
      expect(guard.readline).toBeNull();
      expect(guard.activeApp).toBeNull();
      expect(guard.onChange).toBeNull();
    });

    it('accepts overrides and derives the self process name', () => {
      const guard = createGuard({ execPath: 'C:\\apps\\Desktop-Reminder.EXE' });

      expect(guard.platform).toBe('win32');
      expect(guard.spawnProcess).toBe(spawnProcess);
      expect(guard.selfName).toBe('desktop-reminder');
    });
  });

  describe('start', () => {
    it('spawns a hidden powershell watcher with an encoded script', () => {
      const guard = createGuard();

      guard.start();

      expect(spawnProcess).toHaveBeenCalledWith(
        'powershell.exe',
        ['-NoProfile', '-NonInteractive', '-EncodedCommand', expect.any(String)],
        { windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] }
      );
      expect(guard.watcher).toBe(watcher);
    });

    it('does nothing on non-Windows platforms', () => {
      const guard = createGuard({ platform: 'linux' });

      guard.start();

      expect(spawnProcess).not.toHaveBeenCalled();
      expect(guard.watcher).toBeNull();
    });

    it('does nothing when already watching', () => {
      const guard = createGuard();

      guard.start();
      guard.start();

      expect(spawnProcess).toHaveBeenCalledTimes(1);
    });
  });

  describe('active app tracking', () => {
    it('tracks the foreground process name', async () => {
      const guard = createGuard();
      guard.start();

      watcher.stdout.write('dota2\n');
      await flushStream();

      expect(guard.activeApp).toBe('dota2');
    });

    it('treats blank output as no active app', async () => {
      const guard = createGuard();
      guard.start();

      watcher.stdout.write('\n');
      await flushStream();

      expect(guard.activeApp).toBeNull();
    });

    it('ignores its own process', async () => {
      const guard = createGuard();
      guard.start();

      watcher.stdout.write('ELECTRON\n');
      await flushStream();

      expect(guard.activeApp).toBeNull();
    });

    it('notifies the change callback', async () => {
      const guard = createGuard();
      const onChange = jest.fn();
      guard.setOnChange(onChange);
      guard.start();

      watcher.stdout.write('dota2\n');
      await flushStream();

      expect(onChange).toHaveBeenCalledTimes(1);
    });

    it('does not throw when no change callback is set', async () => {
      const guard = createGuard();
      guard.start();

      watcher.stdout.write('dota2\n');
      await flushStream();

      expect(guard.activeApp).toBe('dota2');
    });
  });

  describe('isBlocked', () => {
    it('matches case-insensitively and ignores the .exe suffix', async () => {
      const guard = createGuard();
      guard.start();

      watcher.stdout.write('DOTA2\n');
      await flushStream();

      expect(guard.isBlocked(['DarkSoulsIII', 'dota2.exe'])).toBe(true);
    });

    it('returns false when no active app is known', () => {
      const guard = createGuard();

      expect(guard.isBlocked(['dota2'])).toBe(false);
    });

    it('returns false for an empty list', async () => {
      const guard = createGuard();
      guard.start();

      watcher.stdout.write('dota2\n');
      await flushStream();

      expect(guard.isBlocked([])).toBe(false);
    });

    it('returns false for a non-array list', async () => {
      const guard = createGuard();
      guard.start();

      watcher.stdout.write('dota2\n');
      await flushStream();

      expect(guard.isBlocked(undefined)).toBe(false);
    });

    it('returns false when the active app is not listed', async () => {
      const guard = createGuard();
      guard.start();

      watcher.stdout.write('explorer\n');
      await flushStream();

      expect(guard.isBlocked(['dota2'])).toBe(false);
    });
  });

  describe('stop', () => {
    it('kills the watcher and clears state', () => {
      const guard = createGuard();
      guard.start();

      guard.stop();

      expect(watcher.kill).toHaveBeenCalled();
      expect(guard.watcher).toBeNull();
      expect(guard.readline).toBeNull();
      expect(guard.activeApp).toBeNull();
    });

    it('does nothing when not watching', () => {
      const guard = createGuard();

      expect(() => guard.stop()).not.toThrow();
    });

    it('ignores exit events after stop', () => {
      const guard = createGuard();
      const onChange = jest.fn();
      guard.setOnChange(onChange);
      guard.start();

      guard.stop();
      watcher.emit('exit', 0);

      expect(onChange).not.toHaveBeenCalled();
    });
  });

  describe('watcher failures', () => {
    it('clears state and notifies when the watcher exits', async () => {
      const guard = createGuard();
      const onChange = jest.fn();
      guard.setOnChange(onChange);
      guard.start();

      watcher.stdout.write('dota2\n');
      await flushStream();
      watcher.emit('exit', 1);

      expect(guard.watcher).toBeNull();
      expect(guard.readline).toBeNull();
      expect(guard.activeApp).toBeNull();
      expect(onChange).toHaveBeenCalledTimes(2);
    });

    it('handles spawn errors', () => {
      const guard = createGuard();
      guard.start();

      watcher.emit('error', new Error('spawn failed'));

      expect(guard.watcher).toBeNull();
      expect(guard.activeApp).toBeNull();
    });

    it('ignores a second failure event', () => {
      const guard = createGuard();
      guard.start();

      watcher.emit('error', new Error('spawn failed'));

      expect(() => watcher.emit('exit', 1)).not.toThrow();
    });
  });
});
