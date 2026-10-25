const { spawn } = require('child_process');
const path = require('path');
const readline = require('readline');

const POLL_INTERVAL_MS = 1000;

const SCRIPT = `
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$typeDefinition = @"
using System;
using System.Runtime.InteropServices;
public class FocusWindow {
  [DllImport("user32.dll")]
  public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")]
  public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);
}
"@
Add-Type -TypeDefinition $typeDefinition
$lastHandle = [IntPtr]::Zero
$lastName = $null
while ($true) {
  $handle = [FocusWindow]::GetForegroundWindow()
  if ($handle -ne $lastHandle) {
    $lastHandle = $handle
    $procId = 0
    [FocusWindow]::GetWindowThreadProcessId($handle, [ref]$procId) | Out-Null
    $process = Get-Process -Id $procId -ErrorAction SilentlyContinue
    $name = if ($process) { $process.ProcessName } else { '' }
    if ($name -ne $lastName) {
      [Console]::Out.WriteLine($name)
      [Console]::Out.Flush()
      $lastName = $name
    }
  }
  Start-Sleep -Milliseconds ${POLL_INTERVAL_MS}
}
`;

const ENCODED_SCRIPT = Buffer.from(SCRIPT, 'utf16le').toString('base64');

class FocusGuard {
  constructor({
    platform = process.platform,
    spawnProcess = spawn,
    execPath = process.execPath,
  } = {}) {
    this.platform = platform;
    this.spawnProcess = spawnProcess;
    this.selfName = path.basename(execPath, path.extname(execPath)).toLowerCase();
    this.watcher = null;
    this.readline = null;
    this.activeApp = null;
    this.onChange = null;
  }

  setOnChange(callback) {
    this.onChange = callback;
  }

  start() {
    if (this.platform !== 'win32' || this.watcher) return;

    const watcher = this.spawnProcess(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-EncodedCommand', ENCODED_SCRIPT],
      { windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] }
    );

    this.watcher = watcher;

    const lines = readline.createInterface({ input: watcher.stdout });
    this.readline = lines;

    lines.on('line', (line) => {
      const name = line.trim();
      if (name.toLowerCase() === this.selfName) return;

      this.activeApp = name || null;
      this.#notifyChange();
    });

    watcher.on('error', () => this.#handleExit());
    watcher.on('exit', () => this.#handleExit());
  }

  stop() {
    if (!this.watcher) return;

    const watcher = this.watcher;
    this.watcher = null;
    this.activeApp = null;
    this.readline.close();
    this.readline = null;

    watcher.removeAllListeners('error');
    watcher.removeAllListeners('exit');
    watcher.kill();
  }

  isBlocked(apps) {
    if (!this.activeApp || !Array.isArray(apps) || apps.length === 0) return false;

    const activeApp = FocusGuard.#normalize(this.activeApp);
    return apps.some((app) => FocusGuard.#normalize(app) === activeApp);
  }

  static #normalize(name) {
    return name.trim().toLowerCase().replace(/\.exe$/, '');
  }

  #handleExit() {
    if (!this.watcher) return;

    this.watcher = null;
    this.readline.close();
    this.readline = null;
    this.activeApp = null;
    this.#notifyChange();
  }

  #notifyChange() {
    if (this.onChange) this.onChange();
  }
}

module.exports = FocusGuard;
