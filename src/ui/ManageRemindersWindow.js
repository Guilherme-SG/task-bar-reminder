const { BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const ProcessList = require('../core/ProcessList.js');

class ManageRemindersWindow {
  constructor() {
    this.window = null;
    this.quitting = false;
    this.onSave = null;
    this.onUpdate = null;
    this.onDelete = null;
    this.onGetReminders = null;
    this.onOpenSounds = null;

    ipcMain.removeHandler('save-reminder');
    ipcMain.handle('save-reminder', async (_, reminderData) => {
      if (this.onSave) {
        try {
          await this.onSave(reminderData);
          return { success: true };
        } catch (err) {
          return { success: false, error: err.message };
        }
      }
      return { success: false, error: 'No save handler configured' };
    });

    ipcMain.removeHandler('update-reminder');
    ipcMain.handle('update-reminder', async (_, id, reminderData) => {
      if (this.onUpdate) {
        try {
          await this.onUpdate(id, reminderData);
          return { success: true };
        } catch (err) {
          return { success: false, error: err.message };
        }
      }
      return { success: false, error: 'No update handler configured' };
    });

    ipcMain.removeHandler('delete-reminder');
    ipcMain.handle('delete-reminder', async (_, id) => {
      if (this.onDelete) {
        try {
          await this.onDelete(id);
          return { success: true };
        } catch (err) {
          return { success: false, error: err.message };
        }
      }
      return { success: false, error: 'No delete handler configured' };
    });

    ipcMain.removeHandler('get-reminders');
    ipcMain.handle('get-reminders', async () => {
      if (this.onGetReminders) {
        return this.onGetReminders();
      }
      return [];
    });

    ipcMain.removeHandler('get-available-processes');
    ipcMain.handle('get-available-processes', async (_, options) => {
      return ProcessList.getAvailableProcesses(options);
    });

    ipcMain.removeHandler('browse-exe-file');
    ipcMain.handle('browse-exe-file', async () => {
      const result = await dialog.showOpenDialog({
        title: 'Select Application Executable',
        properties: ['openFile'],
        filters: [{ name: 'Executable files', extensions: ['exe'] }],
      });

      if (!result.canceled && result.filePaths && result.filePaths.length > 0) {
        const filePath = result.filePaths[0];
        const base = path.basename(filePath, path.extname(filePath));
        return {
          name: base,
          processName: base.toLowerCase(),
        };
      }
      return null;
    });

    ipcMain.removeAllListeners('open-sounds-folder');
    ipcMain.on('open-sounds-folder', () => {
      if (this.onOpenSounds) {
        this.onOpenSounds();
      }
    });

    ipcMain.removeAllListeners('close-manage-reminders');
    ipcMain.on('close-manage-reminders', () => {
      this.hide();
    });
  }

  setOnSave(callback) {
    this.onSave = callback;
  }

  setOnUpdate(callback) {
    this.onUpdate = callback;
  }

  setOnDelete(callback) {
    this.onDelete = callback;
  }

  setOnGetReminders(callback) {
    this.onGetReminders = callback;
  }

  setOnOpenSounds(callback) {
    this.onOpenSounds = callback;
  }

  createWindow() {
    this.window = new BrowserWindow({
      width: 560,
      height: 760,
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

    this.window.loadFile(path.join(__dirname, 'manage-reminders.html'));

    this.window.on('close', (event) => {
      if (this.quitting) return;
      event.preventDefault();
      this.window.hide();
    });
  }

  show(mode = 'list', reminderId = null) {
    if (!this.window || this.window.isDestroyed()) {
      this.createWindow();
    }
    this.window.show();
    this.window.focus();

    this.window.webContents.send('init-view', { mode, reminderId });
  }

  hide() {
    if (this.window && !this.window.isDestroyed()) {
      this.window.hide();
    }
  }
}

module.exports = ManageRemindersWindow;
