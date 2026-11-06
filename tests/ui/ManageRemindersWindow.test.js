let mockBrowserWindow;

jest.mock('../../src/core/ProcessList', () => ({
  getAvailableProcesses: jest.fn().mockResolvedValue([
    { name: 'Discord', processName: 'discord', isRunning: false },
  ]),
}));

jest.mock('electron', () => {
  return {
    BrowserWindow: jest.fn(() => mockBrowserWindow),
    dialog: {
      showOpenDialog: jest.fn(),
    },
    ipcMain: {
      removeHandler: jest.fn(),
      handle: jest.fn(),
      removeAllListeners: jest.fn(),
      on: jest.fn(),
    },
  };
});

const { BrowserWindow, ipcMain, dialog } = require('electron');
const ProcessList = require('../../src/core/ProcessList');
const ManageRemindersWindow = require('../../src/ui/ManageRemindersWindow');

describe('ManageRemindersWindow', () => {
  let manageWindow;

  beforeEach(() => {
    mockBrowserWindow = {
      show: jest.fn(),
      hide: jest.fn(),
      focus: jest.fn(),
      isDestroyed: jest.fn().mockReturnValue(false),
      loadFile: jest.fn(),
      on: jest.fn(),
      webContents: {
        send: jest.fn(),
      },
    };
    jest.clearAllMocks();
    manageWindow = new ManageRemindersWindow();
  });

  describe('constructor and IPC handlers', () => {
    it('sets up all IPC handlers and listeners', () => {
      expect(ipcMain.removeHandler).toHaveBeenCalledWith('save-reminder');
      expect(ipcMain.removeHandler).toHaveBeenCalledWith('update-reminder');
      expect(ipcMain.removeHandler).toHaveBeenCalledWith('delete-reminder');
      expect(ipcMain.removeHandler).toHaveBeenCalledWith('get-reminders');
      expect(ipcMain.removeHandler).toHaveBeenCalledWith('get-available-processes');
      expect(ipcMain.removeHandler).toHaveBeenCalledWith('browse-exe-file');
      expect(ipcMain.removeAllListeners).toHaveBeenCalledWith('open-sounds-folder');
      expect(ipcMain.removeAllListeners).toHaveBeenCalledWith('close-manage-reminders');
    });

    it('handles save-reminder without and with onSave', async () => {
      const handler = ipcMain.handle.mock.calls.find((c) => c[0] === 'save-reminder')[1];

      // Without onSave
      const res1 = await handler({}, { title: 'Test' });
      expect(res1).toEqual({ success: false, error: 'No save handler configured' });

      // With onSave success
      const mockSave = jest.fn().mockResolvedValue(undefined);
      manageWindow.setOnSave(mockSave);
      const res2 = await handler({}, { title: 'Test' });
      expect(mockSave).toHaveBeenCalledWith({ title: 'Test' });
      expect(res2).toEqual({ success: true });

      // With onSave failure
      manageWindow.setOnSave(jest.fn().mockRejectedValue(new Error('Save error')));
      const res3 = await handler({}, { title: 'Test' });
      expect(res3).toEqual({ success: false, error: 'Save error' });
    });

    it('handles update-reminder without and with onUpdate', async () => {
      const handler = ipcMain.handle.mock.calls.find((c) => c[0] === 'update-reminder')[1];

      // Without onUpdate
      const res1 = await handler({}, 'water', { title: 'Water 2' });
      expect(res1).toEqual({ success: false, error: 'No update handler configured' });

      // With onUpdate success
      const mockUpdate = jest.fn().mockResolvedValue(undefined);
      manageWindow.setOnUpdate(mockUpdate);
      const res2 = await handler({}, 'water', { title: 'Water 2' });
      expect(mockUpdate).toHaveBeenCalledWith('water', { title: 'Water 2' });
      expect(res2).toEqual({ success: true });

      // With onUpdate error
      manageWindow.setOnUpdate(jest.fn().mockRejectedValue(new Error('Update error')));
      const res3 = await handler({}, 'water', { title: 'Water 2' });
      expect(res3).toEqual({ success: false, error: 'Update error' });
    });

    it('handles delete-reminder without and with onDelete', async () => {
      const handler = ipcMain.handle.mock.calls.find((c) => c[0] === 'delete-reminder')[1];

      // Without onDelete
      const res1 = await handler({}, 'water');
      expect(res1).toEqual({ success: false, error: 'No delete handler configured' });

      // With onDelete success
      const mockDelete = jest.fn().mockResolvedValue(undefined);
      manageWindow.setOnDelete(mockDelete);
      const res2 = await handler({}, 'water');
      expect(mockDelete).toHaveBeenCalledWith('water');
      expect(res2).toEqual({ success: true });

      // With onDelete error
      manageWindow.setOnDelete(jest.fn().mockRejectedValue(new Error('Delete error')));
      const res3 = await handler({}, 'water');
      expect(res3).toEqual({ success: false, error: 'Delete error' });
    });

    it('handles get-reminders without and with onGetReminders', async () => {
      const handler = ipcMain.handle.mock.calls.find((c) => c[0] === 'get-reminders')[1];

      // Without callback
      expect(await handler()).toEqual([]);

      // With callback
      manageWindow.setOnGetReminders(() => [{ id: 'water', title: 'Water' }]);
      expect(await handler()).toEqual([{ id: 'water', title: 'Water' }]);
    });

    it('handles get-available-processes', async () => {
      const handler = ipcMain.handle.mock.calls.find((c) => c[0] === 'get-available-processes')[1];
      const res = await handler({}, { forceRefresh: true });

      expect(ProcessList.getAvailableProcesses).toHaveBeenCalledWith({ forceRefresh: true });
      expect(res).toEqual([{ name: 'Discord', processName: 'discord', isRunning: false }]);
    });

    it('handles browse-exe-file when file selected and when canceled', async () => {
      const handler = ipcMain.handle.mock.calls.find((c) => c[0] === 'browse-exe-file')[1];

      // Selected file
      dialog.showOpenDialog.mockResolvedValueOnce({
        canceled: false,
        filePaths: ['C:\\Games\\Steam\\cs2.exe'],
      });
      const res1 = await handler();
      expect(res1).toEqual({ name: 'cs2', processName: 'cs2' });

      // Canceled
      dialog.showOpenDialog.mockResolvedValueOnce({
        canceled: true,
        filePaths: [],
      });
      const res2 = await handler();
      expect(res2).toBeNull();
    });

    it('handles open-sounds-folder IPC event', () => {
      const listener = ipcMain.on.mock.calls.find((c) => c[0] === 'open-sounds-folder')[1];
      expect(() => listener()).not.toThrow();

      const mockOpen = jest.fn();
      manageWindow.setOnOpenSounds(mockOpen);
      listener();
      expect(mockOpen).toHaveBeenCalled();
    });

    it('handles close-manage-reminders IPC event', () => {
      manageWindow.show();
      const listener = ipcMain.on.mock.calls.find((c) => c[0] === 'close-manage-reminders')[1];
      listener();

      expect(manageWindow.window.hide).toHaveBeenCalled();
    });
  });

  describe('show and window lifecycle', () => {
    it('creates and shows window when window is null', () => {
      expect(manageWindow.window).toBeNull();
      manageWindow.show('edit', 'water');

      expect(BrowserWindow).toHaveBeenCalled();
      expect(manageWindow.window.show).toHaveBeenCalled();
      expect(manageWindow.window.focus).toHaveBeenCalled();
      expect(manageWindow.window.webContents.send).toHaveBeenCalledWith('init-view', {
        mode: 'edit',
        reminderId: 'water',
      });
    });

    it('re-creates window if previously destroyed', () => {
      manageWindow.show();
      manageWindow.window.isDestroyed.mockReturnValue(true);

      BrowserWindow.mockClear();
      manageWindow.show();

      expect(BrowserWindow).toHaveBeenCalled();
    });

    it('reuses existing window if not destroyed', () => {
      manageWindow.show();
      BrowserWindow.mockClear();

      manageWindow.show('list');
      expect(BrowserWindow).not.toHaveBeenCalled();
      expect(manageWindow.window.show).toHaveBeenCalledTimes(2);
    });

    it('intercepts window close to hide instead of exit when not quitting', () => {
      manageWindow.show();
      const closeHandler = manageWindow.window.on.mock.calls.find((c) => c[0] === 'close')[1];

      const event = { preventDefault: jest.fn() };
      closeHandler(event);

      expect(event.preventDefault).toHaveBeenCalled();
      expect(manageWindow.window.hide).toHaveBeenCalled();
    });

    it('allows window to close when quitting is true', () => {
      manageWindow.show();
      manageWindow.quitting = true;
      const closeHandler = manageWindow.window.on.mock.calls.find((c) => c[0] === 'close')[1];

      const event = { preventDefault: jest.fn() };
      closeHandler(event);

      expect(event.preventDefault).not.toHaveBeenCalled();
    });
  });

  describe('hide', () => {
    it('does nothing if window is null', () => {
      expect(() => manageWindow.hide()).not.toThrow();
    });

    it('does nothing if window is destroyed', () => {
      manageWindow.show();
      manageWindow.window.isDestroyed.mockReturnValue(true);

      manageWindow.hide();
      expect(manageWindow.window.hide).not.toHaveBeenCalled();
    });

    it('hides window if alive', () => {
      manageWindow.show();
      manageWindow.hide();

      expect(manageWindow.window.hide).toHaveBeenCalled();
    });
  });
});
