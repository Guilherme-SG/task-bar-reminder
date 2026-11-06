const ProcessList = require('../../src/core/ProcessList');

describe('ProcessList', () => {
  beforeEach(() => {
    ProcessList.cachedApps = null;
    ProcessList.isScanning = false;
  });

  describe('getRunningProcesses', () => {
    it('returns empty array when platform is not win32', async () => {
      const result = await ProcessList.getRunningProcesses({ platform: 'darwin' });
      expect(result).toEqual([]);
    });

    it('returns empty array when exec fails with an error', async () => {
      const fakeExec = jest.fn((cmd, args, opts, cb) => {
        cb(new Error('Command failed'), null);
      });

      const result = await ProcessList.getRunningProcesses({ platform: 'win32', exec: fakeExec });
      expect(result).toEqual([]);
    });

    it('returns empty array when stdout is empty', async () => {
      const fakeExec = jest.fn((cmd, args, opts, cb) => {
        cb(null, '');
      });

      const result = await ProcessList.getRunningProcesses({ platform: 'win32', exec: fakeExec });
      expect(result).toEqual([]);
    });

    it('filters system processes, deduplicates, and sorts', async () => {
      const stdout = [
        'svchost',
        'chrome',
        'CHROME',
        'discord',
        'system',
        'dwm',
        'dota2',
        '',
        '   ',
      ].join('\r\n');

      const fakeExec = jest.fn((cmd, args, opts, cb) => {
        cb(null, stdout);
      });

      const result = await ProcessList.getRunningProcesses({ platform: 'win32', exec: fakeExec });
      expect(result).toEqual(['chrome', 'discord', 'dota2']);
    });

    it('works with default parameters on win32', async () => {
      const result = await ProcessList.getRunningProcesses();
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('getInstalledApps', () => {
    it('returns empty array when platform is not win32', async () => {
      const result = await ProcessList.getInstalledApps({ platform: 'linux' });
      expect(result).toEqual([]);
    });

    it('works with default parameters on win32', async () => {
      const result = await ProcessList.getInstalledApps();
      expect(Array.isArray(result)).toBe(true);
    });

    it('returns empty array when exec fails', async () => {
      const fakeExec = jest.fn((cmd, args, opts, cb) => {
        cb(new Error('Failed'), null);
      });

      const result = await ProcessList.getInstalledApps({ platform: 'win32', exec: fakeExec });
      expect(result).toEqual([]);
    });

    it('returns empty array when stdout is empty', async () => {
      const fakeExec = jest.fn((cmd, args, opts, cb) => {
        cb(null, '');
      });

      const result = await ProcessList.getInstalledApps({ platform: 'win32', exec: fakeExec });
      expect(result).toEqual([]);
    });

    it('parses shortcuts and filters invalid lines & system processes', async () => {
      const stdout = [
        'Counter-Strike 2|cs2',
        'Duplicate CS2|cs2',
        'Task Host|taskhostw',
        'InvalidLineWithoutSeparator',
        'EmptyProcess|',
        '|EmptyName',
        'Google Chrome|chrome',
      ].join('\n');

      const fakeExec = jest.fn((cmd, args, opts, cb) => {
        cb(null, stdout);
      });

      const result = await ProcessList.getInstalledApps({ platform: 'win32', exec: fakeExec });
      expect(result).toEqual([
        { name: 'Counter-Strike 2', processName: 'cs2' },
        { name: 'Google Chrome', processName: 'chrome' },
      ]);
    });
  });

  describe('getAvailableProcesses', () => {
    it('merges curated apps, installed apps, and running processes', async () => {
      const fakeExec = jest.fn((cmd, args, opts, cb) => {
        if (args.includes('Get-Process | Select-Object -ExpandProperty ProcessName -Unique')) {
          cb(null, 'discord\r\ncustomgame\r\n');
        } else {
          cb(null, 'Notepad++|notepad++\r\nDiscord|discord\r\n');
        }
      });

      const result = await ProcessList.getAvailableProcesses({ platform: 'win32', exec: fakeExec });

      const discord = result.find((a) => a.processName === 'discord');
      expect(discord).toBeDefined();
      expect(discord.isRunning).toBe(true);

      const npp = result.find((a) => a.processName === 'notepad++');
      expect(npp).toBeDefined();
      expect(npp.name).toBe('Notepad++');
      expect(npp.isRunning).toBe(false);

      const custom = result.find((a) => a.processName === 'customgame');
      expect(custom).toBeDefined();
      expect(custom.isRunning).toBe(true);
    });

    it('uses cached apps on subsequent calls without forceRefresh', async () => {
      ProcessList.cachedApps = [
        { name: 'Steam', processName: 'steam', isRunning: false },
        { name: 'Discord', processName: 'discord', isRunning: false },
      ];

      const fakeExec = jest.fn((cmd, args, opts, cb) => {
        cb(null, 'steam\n');
      });

      const result = await ProcessList.getAvailableProcesses({
        platform: 'win32',
        exec: fakeExec,
      });

      expect(result).toEqual([
        { name: 'Discord', processName: 'discord', isRunning: false },
        { name: 'Steam', processName: 'steam', isRunning: true },
      ]);
    });

    it('refreshes cache when forceRefresh is true', async () => {
      ProcessList.cachedApps = [
        { name: 'Old', processName: 'old', isRunning: false },
      ];

      const fakeExec = jest.fn((cmd, args, opts, cb) => {
        cb(null, 'dota2\n');
      });

      const result = await ProcessList.getAvailableProcesses({
        platform: 'win32',
        exec: fakeExec,
        forceRefresh: true,
      });

      const dota = result.find((a) => a.processName === 'dota2');
      expect(dota.isRunning).toBe(true);
    });

    it('works with default parameters when called with no arguments', async () => {
      const result = await ProcessList.getAvailableProcesses();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('startBackgroundScan', () => {
    it('starts background scan and sets cachedApps', async () => {
      const fakeExec = jest.fn((cmd, args, opts, cb) => {
        cb(null, 'discord\n');
      });

      const p = ProcessList.startBackgroundScan({ platform: 'win32', exec: fakeExec });
      expect(ProcessList.isScanning).toBe(true);
      await p;
      expect(ProcessList.isScanning).toBe(false);
      expect(ProcessList.cachedApps).not.toBeNull();
    });

    it('does not start scan if already scanning or already cached', () => {
      ProcessList.isScanning = true;
      ProcessList.startBackgroundScan();
      expect(ProcessList.isScanning).toBe(true);

      ProcessList.isScanning = false;
      ProcessList.cachedApps = [];
      ProcessList.startBackgroundScan();
      expect(ProcessList.isScanning).toBe(false);
    });

    it('handles background scan rejection gracefully', async () => {
      jest.spyOn(ProcessList, 'getAvailableProcesses').mockRejectedValueOnce(new Error('Boom'));

      await ProcessList.startBackgroundScan();
      expect(ProcessList.isScanning).toBe(false);
    });
  });
});
