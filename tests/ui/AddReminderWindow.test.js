let mockBrowserWindow;

jest.mock('electron', () => {
  return {
    BrowserWindow: jest.fn(() => mockBrowserWindow),
    ipcMain: {
      removeHandler: jest.fn(),
      handle: jest.fn(),
      removeAllListeners: jest.fn(),
      on: jest.fn(),
    },
  };
});

const { BrowserWindow, ipcMain } = require('electron');
const AddReminderWindow = require('../../src/ui/AddReminderWindow');

describe('AddReminderWindow', () => {
  let addReminderWindow;

  beforeEach(() => {
    mockBrowserWindow = {
      show: jest.fn(),
      hide: jest.fn(),
      focus: jest.fn(),
      isDestroyed: jest.fn().mockReturnValue(false),
      loadFile: jest.fn(),
      on: jest.fn(),
    };
    jest.clearAllMocks();
    addReminderWindow = new AddReminderWindow();
  });

  describe('constructor', () => {
    it('sets up IPC handlers and listeners', () => {
      expect(ipcMain.removeHandler).toHaveBeenCalledWith('save-reminder');
      expect(ipcMain.handle).toHaveBeenCalledWith('save-reminder', expect.any(Function));
      expect(ipcMain.removeAllListeners).toHaveBeenCalledWith('close-add-reminder');
      expect(ipcMain.on).toHaveBeenCalledWith('close-add-reminder', expect.any(Function));
    });

    it('returns error if save-reminder called without onSave configured', async () => {
      const handler = ipcMain.handle.mock.calls.find((c) => c[0] === 'save-reminder')[1];
      const result = await handler({}, { title: 'Test' });

      expect(result).toEqual({ success: false, error: 'No save handler configured' });
    });

    it('calls onSave and hides window on success', async () => {
      const mockSave = jest.fn().mockResolvedValue(undefined);
      addReminderWindow.setOnSave(mockSave);
      addReminderWindow.show();

      const handler = ipcMain.handle.mock.calls.find((c) => c[0] === 'save-reminder')[1];
      const result = await handler({}, { title: 'Test' });

      expect(mockSave).toHaveBeenCalledWith({ title: 'Test' });
      expect(addReminderWindow.window.hide).toHaveBeenCalled();
      expect(result).toEqual({ success: true });
    });

    it('does not throw on save success if window is destroyed', async () => {
      const mockSave = jest.fn().mockResolvedValue(undefined);
      addReminderWindow.setOnSave(mockSave);
      addReminderWindow.show();
      addReminderWindow.window.isDestroyed.mockReturnValue(true);

      const handler = ipcMain.handle.mock.calls.find((c) => c[0] === 'save-reminder')[1];
      const result = await handler({}, { title: 'Test' });

      expect(result).toEqual({ success: true });
    });

    it('catches and returns error if onSave rejects', async () => {
      const mockSave = jest.fn().mockRejectedValue(new Error('Validation failed'));
      addReminderWindow.setOnSave(mockSave);

      const handler = ipcMain.handle.mock.calls.find((c) => c[0] === 'save-reminder')[1];
      const result = await handler({}, { title: 'Test' });

      expect(result).toEqual({ success: false, error: 'Validation failed' });
    });

    it('hides window on close-add-reminder IPC event', () => {
      addReminderWindow.show();
      const listener = ipcMain.on.mock.calls.find((c) => c[0] === 'close-add-reminder')[1];
      listener();

      expect(addReminderWindow.window.hide).toHaveBeenCalled();
    });
  });

  describe('setOnSave', () => {
    it('stores the onSave callback', () => {
      const cb = jest.fn();
      addReminderWindow.setOnSave(cb);
      expect(addReminderWindow.onSave).toBe(cb);
    });
  });

  describe('show', () => {
    it('creates and shows window when window is null', () => {
      expect(addReminderWindow.window).toBeNull();
      addReminderWindow.show();

      expect(BrowserWindow).toHaveBeenCalled();
      expect(addReminderWindow.window.show).toHaveBeenCalled();
      expect(addReminderWindow.window.focus).toHaveBeenCalled();
    });

    it('re-creates window if previously destroyed', () => {
      addReminderWindow.show();
      addReminderWindow.window.isDestroyed.mockReturnValue(true);

      BrowserWindow.mockClear();
      addReminderWindow.show();

      expect(BrowserWindow).toHaveBeenCalled();
    });

    it('reuses existing window if not destroyed', () => {
      addReminderWindow.show();
      BrowserWindow.mockClear();

      addReminderWindow.show();
      expect(BrowserWindow).not.toHaveBeenCalled();
      expect(addReminderWindow.window.show).toHaveBeenCalledTimes(2);
    });

    it('intercepts window close to hide instead of exit when not quitting', () => {
      addReminderWindow.show();
      const closeHandler = addReminderWindow.window.on.mock.calls.find((c) => c[0] === 'close')[1];

      const event = { preventDefault: jest.fn() };
      closeHandler(event);

      expect(event.preventDefault).toHaveBeenCalled();
      expect(addReminderWindow.window.hide).toHaveBeenCalled();
    });

    it('allows window to close when quitting is true', () => {
      addReminderWindow.show();
      addReminderWindow.quitting = true;
      const closeHandler = addReminderWindow.window.on.mock.calls.find((c) => c[0] === 'close')[1];

      const event = { preventDefault: jest.fn() };
      closeHandler(event);

      expect(event.preventDefault).not.toHaveBeenCalled();
    });
  });

  describe('hide', () => {
    it('does nothing if window is null', () => {
      expect(() => addReminderWindow.hide()).not.toThrow();
    });

    it('does nothing if window is destroyed', () => {
      addReminderWindow.show();
      addReminderWindow.window.isDestroyed.mockReturnValue(true);

      addReminderWindow.hide();
      expect(addReminderWindow.window.hide).not.toHaveBeenCalled();
    });

    it('hides window if alive', () => {
      addReminderWindow.show();
      addReminderWindow.hide();

      expect(addReminderWindow.window.hide).toHaveBeenCalled();
    });
  });
});
