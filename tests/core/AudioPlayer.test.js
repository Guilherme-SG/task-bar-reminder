jest.mock('child_process', () => ({
  spawn: jest.fn(),
}));

jest.mock('fs', () => ({
  existsSync: jest.fn(),
  readdirSync: jest.fn(),
}));

const { EventEmitter } = require('events');
const { spawn } = require('child_process');
const fs = require('fs');
const AudioPlayer = require('../../src/core/AudioPlayer');

describe('AudioPlayer', () => {
  let player;

  beforeEach(() => {
    jest.clearAllMocks();
    player = new AudioPlayer('/fake/ffplay.exe');
  });

  describe('play', () => {
    it('spawns ffplay and resolves on exit', async () => {
      fs.existsSync.mockReturnValue(true);
      const mockProcess = new EventEmitter();
      mockProcess.kill = jest.fn();
      spawn.mockReturnValue(mockProcess);

      const promise = player.play('/fake/audio.mp3');

      expect(spawn).toHaveBeenCalledWith(
        '/fake/ffplay.exe',
        ['-nodisp', '-autoexit', '-loglevel', 'quiet', '/fake/audio.mp3'],
        { detached: false, stdio: 'ignore' }
      );

      mockProcess.emit('exit');

      await promise;
      expect(player.currentProcess).toBeNull();
    });

    it('resolves when ffplay path is empty', async () => {
      player = new AudioPlayer('');

      await player.play('/fake/audio.mp3');

      expect(spawn).not.toHaveBeenCalled();
    });

    it('resolves when ffplay does not exist', async () => {
      fs.existsSync.mockReturnValue(false);

      await player.play('/fake/audio.mp3');

      expect(spawn).not.toHaveBeenCalled();
    });

    it('resolves when audio file does not exist', async () => {
      fs.existsSync
        .mockReturnValueOnce(true)   // ffplay exists
        .mockReturnValueOnce(false);  // audio file does not exist

      await player.play('/fake/audio.mp3');

      expect(spawn).not.toHaveBeenCalled();
    });

    it('resolves on spawn error', async () => {
      fs.existsSync.mockReturnValue(true);
      const mockProcess = new EventEmitter();
      mockProcess.kill = jest.fn();
      spawn.mockReturnValue(mockProcess);

      const promise = player.play('/fake/audio.mp3');

      mockProcess.emit('error', new Error('spawn failed'));

      await promise;
      expect(player.currentProcess).toBeNull();
    });

    it('kills previous process before starting new one', async () => {
      fs.existsSync.mockReturnValue(true);
      const mockProcess1 = new EventEmitter();
      mockProcess1.kill = jest.fn();
      const mockProcess2 = new EventEmitter();
      mockProcess2.kill = jest.fn();
      spawn
        .mockReturnValueOnce(mockProcess1)
        .mockReturnValueOnce(mockProcess2);

      // Start first play but don't resolve it yet
      const promise1 = player.play('/fake/audio1.mp3');

      // currentProcess is now mockProcess1
      expect(player.currentProcess).toBe(mockProcess1);

      // Start second play - should kill mockProcess1
      const promise2 = player.play('/fake/audio2.mp3');

      expect(mockProcess1.kill).toHaveBeenCalled();
      expect(player.currentProcess).toBe(mockProcess2);

      // Resolve both
      mockProcess1.emit('exit');
      mockProcess2.emit('exit');
      await Promise.all([promise1, promise2]);
    });
  });

  describe('stop', () => {
    it('kills current process', () => {
      const mockProcess = new EventEmitter();
      mockProcess.kill = jest.fn();
      player.currentProcess = mockProcess;

      player.stop();

      expect(mockProcess.kill).toHaveBeenCalled();
      expect(player.currentProcess).toBeNull();
    });

    it('does nothing when no process is running', () => {
      expect(() => player.stop()).not.toThrow();
    });
  });

  describe('pickRandom', () => {
    it('returns null when sounds directory does not exist', () => {
      fs.existsSync.mockReturnValue(false);

      expect(player.pickRandom('drink-water', 'alert')).toBeNull();
    });

    it('returns null when no matching files found', () => {
      fs.existsSync.mockReturnValue(true);
      fs.readdirSync.mockReturnValue(['other-file.mp3', 'readme.txt']);

      expect(player.pickRandom('drink-water', 'alert')).toBeNull();
    });

    it('returns a matching file path', () => {
      fs.existsSync.mockReturnValue(true);
      fs.readdirSync.mockReturnValue([
        'drink-water-alert-1.mp3',
        'drink-water-alert-2.mp3',
      ]);

      const result = player.pickRandom('drink-water', 'alert');

      expect(result).toMatch(/drink-water-alert-\d\.mp3$/);
    });

    it('matches exact naming pattern', () => {
      fs.existsSync.mockReturnValue(true);
      fs.readdirSync.mockReturnValue([
        'drink-water-done-1.mp3',
        'drink-water-alert-1.mp3',
        'other-done-1.mp3',
      ]);

      const result = player.pickRandom('drink-water', 'done');

      expect(result).toMatch(/drink-water-done-1\.mp3$/);
    });

    it('handles regex special characters in id', () => {
      fs.existsSync.mockReturnValue(true);
      fs.readdirSync.mockReturnValue(['my.reminder-alert-1.mp3']);

      const result = player.pickRandom('my.reminder', 'alert');

      expect(result).toMatch(/my\.reminder-alert-1\.mp3$/);
    });

    it('returns only .mp3 files', () => {
      fs.existsSync.mockReturnValue(true);
      fs.readdirSync.mockReturnValue([
        'drink-water-alert-1.mp3',
        'drink-water-alert-1.txt',
        'drink-water-alert-1',
      ]);

      const result = player.pickRandom('drink-water', 'alert');

      expect(result).toMatch(/\.mp3$/);
    });
  });
});
