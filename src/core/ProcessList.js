const { execFile } = require('child_process');

const CURATED_APPS = [
  { name: 'Discord', processName: 'discord' },
  { name: 'Steam', processName: 'steam' },
  { name: 'Dota 2', processName: 'dota2' },
  { name: 'Counter-Strike 2', processName: 'cs2' },
  { name: 'Counter-Strike: Global Offensive', processName: 'csgo' },
  { name: 'League of Legends', processName: 'leagueclient' },
  { name: 'Valorant', processName: 'valorant' },
  { name: 'Elden Ring', processName: 'eldenring' },
  { name: 'Google Chrome', processName: 'chrome' },
  { name: 'Mozilla Firefox', processName: 'firefox' },
  { name: 'Microsoft Edge', processName: 'msedge' },
  { name: 'Spotify', processName: 'spotify' },
  { name: 'Slack', processName: 'slack' },
  { name: 'Zoom', processName: 'zoom' },
  { name: 'Microsoft Teams', processName: 'teams' },
  { name: 'Visual Studio Code', processName: 'code' },
  { name: 'OBS Studio', processName: 'obs64' },
  { name: 'VLC Media Player', processName: 'vlc' },
];

const SYSTEM_PROCESSES = new Set([
  'svchost',
  'system',
  'smss',
  'csrss',
  'wininit',
  'services',
  'lsass',
  'winlogon',
  'fontdrvhost',
  'dwm',
  'taskhostw',
  'powershell',
  'conhost',
  'runtimebroker',
  'sihost',
  'ctfmon',
  'idle',
  'memory compression',
  'registry',
]);

const SCAN_SHORTCUTS_SCRIPT = `
$sh = New-Object -ComObject WScript.Shell
$paths = @(
  [Environment]::GetFolderPath('CommonPrograms'),
  [Environment]::GetFolderPath('Programs')
)
Get-ChildItem -Path $paths -Filter *.lnk -Recurse -ErrorAction SilentlyContinue | ForEach-Object {
  try {
    $target = $sh.CreateShortcut($_.FullName).TargetPath
    if ($target -and $target.EndsWith('.exe')) {
      $name = $_.BaseName
      $exe = [System.IO.Path]::GetFileNameWithoutExtension($target)
      Write-Output "$name|$exe"
    }
  } catch {}
}
`;

const ENCODED_SCAN_SCRIPT = Buffer.from(SCAN_SHORTCUTS_SCRIPT, 'utf16le').toString('base64');

class ProcessList {
  static cachedApps = null;
  static isScanning = false;

  static getRunningProcesses({ platform = process.platform, exec = execFile } = {}) {
    if (platform !== 'win32') {
      return Promise.resolve([]);
    }

    return new Promise((resolve) => {
      exec(
        'powershell.exe',
        [
          '-NoProfile',
          '-NonInteractive',
          '-Command',
          'Get-Process | Select-Object -ExpandProperty ProcessName -Unique',
        ],
        { windowsHide: true, timeout: 5000 },
        (error, stdout) => {
          if (error || !stdout) {
            resolve([]);
            return;
          }

          const processes = stdout
            .split(/\r?\n/)
            .map((line) => line.trim().toLowerCase())
            .filter((name) => name.length > 0 && !SYSTEM_PROCESSES.has(name));

          resolve([...new Set(processes)].sort());
        }
      );
    });
  }

  static getInstalledApps({ platform = process.platform, exec = execFile } = {}) {
    if (platform !== 'win32') {
      return Promise.resolve([]);
    }

    return new Promise((resolve) => {
      exec(
        'powershell.exe',
        ['-NoProfile', '-NonInteractive', '-EncodedCommand', ENCODED_SCAN_SCRIPT],
        { windowsHide: true, timeout: 10000 },
        (error, stdout) => {
          if (error || !stdout) {
            resolve([]);
            return;
          }

          const apps = [];
          const seen = new Set();
          const lines = stdout.split(/\r?\n/).filter(Boolean);

          for (const line of lines) {
            const parts = line.split('|');
            if (parts.length >= 2) {
              const name = parts[0].trim();
              const processName = parts[1].trim().toLowerCase();
              if (name && processName && !SYSTEM_PROCESSES.has(processName) && !seen.has(processName)) {
                seen.add(processName);
                apps.push({ name, processName });
              }
            }
          }

          resolve(apps);
        }
      );
    });
  }

  static async getAvailableProcesses(options = {}) {
    const running = await ProcessList.getRunningProcesses(options);
    const runningSet = new Set(running);

    if (ProcessList.cachedApps && !options.forceRefresh) {
      return ProcessList.cachedApps
        .map((app) => ({
          ...app,
          isRunning: runningSet.has(app.processName),
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
    }

    const installed = await ProcessList.getInstalledApps(options);
    const seenProcessNames = new Set();
    const result = [];

    for (const app of CURATED_APPS) {
      result.push({
        name: app.name,
        processName: app.processName,
        isRunning: runningSet.has(app.processName),
      });
      seenProcessNames.add(app.processName);
    }

    for (const app of installed) {
      if (!seenProcessNames.has(app.processName)) {
        result.push({
          name: app.name,
          processName: app.processName,
          isRunning: runningSet.has(app.processName),
        });
        seenProcessNames.add(app.processName);
      }
    }

    for (const processName of running) {
      if (!seenProcessNames.has(processName)) {
        result.push({
          name: processName.charAt(0).toUpperCase() + processName.slice(1),
          processName,
          isRunning: true,
        });
        seenProcessNames.add(processName);
      }
    }

    const sorted = result.sort((a, b) => a.name.localeCompare(b.name));
    ProcessList.cachedApps = sorted;
    return sorted;
  }

  static startBackgroundScan(options = {}) {
    if (ProcessList.cachedApps || ProcessList.isScanning) {
      return Promise.resolve();
    }
    ProcessList.isScanning = true;
    return ProcessList.getAvailableProcesses(options)
      .then(() => {
        ProcessList.isScanning = false;
      })
      .catch(() => {
        ProcessList.isScanning = false;
      });
  }
}

module.exports = ProcessList;
