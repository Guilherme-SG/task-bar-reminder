const { BrowserWindow, ipcMain, screen } = require('electron');
const path = require('path');

function getLuminance(hex) {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

function lightenColor(hex, amount) {
  const r = Math.min(255, parseInt(hex.slice(1, 3), 16) + amount);
  const g = Math.min(255, parseInt(hex.slice(3, 5), 16) + amount);
  const b = Math.min(255, parseInt(hex.slice(5, 7), 16) + amount);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

function darkenColor(hex, amount) {
  const r = Math.max(0, parseInt(hex.slice(1, 3), 16) - amount);
  const g = Math.max(0, parseInt(hex.slice(3, 5), 16) - amount);
  const b = Math.max(0, parseInt(hex.slice(5, 7), 16) - amount);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

class ReminderWindow {
  constructor(config) {
    this.config = config;
    this.window = null;
    this.quitting = false;

    ipcMain.removeAllListeners('reminder-action');
    ipcMain.on('reminder-action', (_, reminderId, action) => {
      if (this.onAction) {
        this.onAction(reminderId, action);
      }
    });

    this.startRecoveryWatch();
  }

  setOnAction(callback) {
    this.onAction = callback;
  }

  showReminder(reminder, stackIndex) {
    if (!this.window) {
      this.createWindow();
    }

    this.window.showInactive();
    this.window.focus();

    const color = reminder.color || this.config.window.defaultColor;

    const data = {
      id: reminder.id,
      title: reminder.title,
      description: reminder.description || '',
      color,
      buttonBg: lightenColor(color, 40),
      snoozeBg: darkenColor(color, 30),
      textColor: getLuminance(color) < 0.5 ? '#ffffff' : '#1a1a2e',
      stackIndex,
    };

    this.window.webContents.send('show-reminder', data);
  }

  removeReminder(reminderId) {
    if (this.window) {
      this.window.webContents.send('remove-reminder', reminderId);
    }
  }

  createWindow() {
    const { width, height } = this.config.window;

    this.window = new BrowserWindow({
      width,
      height,
      resizable: false,
      frame: false,
      transparent: true,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      skipTaskbar: true,
      darkTheme: true,
      autoHideMenuBar: true,
      alwaysOnTop: true,
      show: false,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
      },
    });

    this.window.loadFile(path.join(__dirname, 'reminder.html'));

    this.window.once('ready-to-show', () => {
      this.positionWindow();
    });

    this.window.on('close', (event) => {
      if (this.quitting) return;
      event.preventDefault();
      this.window.hide();
    });
  }

  positionWindow() {
    const { width, height } = this.config.window;
    const display = screen.getPrimaryDisplay();
    const { width: screenWidth, height: screenHeight } = display.workAreaSize;
    const dynamicHeight = Math.min(height, screenHeight / 2);

    this.window.setBounds({
      x: screenWidth - width - 20,
      y: screenHeight - dynamicHeight - 20,
      width,
      height: dynamicHeight,
    });
  }

  startRecoveryWatch() {
    setInterval(() => {
      if (!this.window) return;

      if (!this.window.isVisible() && this.window.webContents) {
        const hasCards = this.window.webContents.executeJavaScript(
          'document.getElementById("stack").children.length > 0'
        );
        hasCards.then((has) => {
          if (has && this.window) {
            this.window.showInactive();
          }
        }).catch(() => {});
      }
    }, 2000);
  }

  hide() {
    if (this.window && !this.window.isDestroyed()) {
      this.window.hide();
    }
  }
}

module.exports = ReminderWindow;
