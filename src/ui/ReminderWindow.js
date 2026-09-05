const { BrowserWindow, ipcMain, screen } = require('electron');
const path = require('path');

class ReminderWindow {
  constructor(config) {
    this.config = config;
    this.window = null;

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

    const data = {
      id: reminder.id,
      title: reminder.title,
      description: reminder.description || '',
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
      height: height + 80,
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
      event.preventDefault();
      this.window.hide();
    });
  }

  positionWindow() {
    const { width } = this.config.window;
    const display = screen.getPrimaryDisplay();
    const { width: screenWidth, height: screenHeight } = display.workAreaSize;
    const dynamicHeight = Math.min(400, screenHeight / 2);

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
