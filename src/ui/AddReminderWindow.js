const { BrowserWindow, ipcMain } = require('electron');
const path = require('path');

class AddReminderWindow {
  constructor() {
    this.window = null;
    this.quitting = false;
    this.onSave = null;

    ipcMain.removeHandler('save-reminder');
    ipcMain.handle('save-reminder', async (_, reminderData) => {
      if (this.onSave) {
        try {
          await this.onSave(reminderData);
          if (this.window && !this.window.isDestroyed()) {
            this.window.hide();
          }
          return { success: true };
        } catch (err) {
          return { success: false, error: err.message };
        }
      }
      return { success: false, error: 'No save handler configured' };
    });

    ipcMain.removeAllListeners('close-add-reminder');
    ipcMain.on('close-add-reminder', () => {
      this.hide();
    });
  }

  setOnSave(callback) {
    this.onSave = callback;
  }

  createWindow() {
    this.window = new BrowserWindow({
      width: 460,
      height: 640,
      resizable: false,
      frame: false,
      transparent: true,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      skipTaskbar: false,
      darkTheme: true,
      autoHideMenuBar: true,
      alwaysOnTop: true,
      center: true,
      show: false,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
      },
    });

    this.window.loadFile(path.join(__dirname, 'add-reminder.html'));

    this.window.on('close', (event) => {
      if (this.quitting) return;
      event.preventDefault();
      this.window.hide();
    });
  }

  show() {
    if (!this.window || this.window.isDestroyed()) {
      this.createWindow();
    }
    this.window.show();
    this.window.focus();
  }

  hide() {
    if (this.window && !this.window.isDestroyed()) {
      this.window.hide();
    }
  }
}

module.exports = AddReminderWindow;
