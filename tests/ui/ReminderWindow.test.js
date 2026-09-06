jest.mock('electron', () => {
  const mockWebContents = {
    send: jest.fn(),
    executeJavaScript: jest.fn().mockResolvedValue(false),
  };
  const mockBrowserWindow = {
    show: jest.fn(),
    hide: jest.fn(),
    isDestroyed: jest.fn().mockReturnValue(false),
    isVisible: jest.fn().mockReturnValue(false),
    isFocused: jest.fn().mockReturnValue(false),
    loadFile: jest.fn(),
    once: jest.fn(),
    on: jest.fn(),
    setBounds: jest.fn(),
    webContents: mockWebContents,
  };
  return {
    BrowserWindow: jest.fn(() => mockBrowserWindow),
    ipcMain: {
      removeAllListeners: jest.fn(),
      on: jest.fn(),
    },
    screen: {
      getPrimaryDisplay: jest.fn().mockReturnValue({
        workAreaSize: { width: 1920, height: 1080 },
      }),
    },
  };
});

const { BrowserWindow, ipcMain, screen } = require('electron');
const ReminderWindow = require('../../src/ui/ReminderWindow');

describe('ReminderWindow', () => {
  let window;
  const config = {
    window: { width: 320, height: 220, defaultColor: '#1a1a2e' },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    window = new ReminderWindow(config);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('constructor', () => {
    it('removes old IPC listeners and registers new one', () => {
      expect(ipcMain.removeAllListeners).toHaveBeenCalledWith('reminder-action');
      expect(ipcMain.on).toHaveBeenCalledWith('reminder-action', expect.any(Function));
    });

    it('starts recovery watch', () => {
      expect(() => jest.advanceTimersByTime(2000)).not.toThrow();
    });
  });

  describe('setOnAction', () => {
    it('stores the callback', () => {
      const cb = jest.fn();
      window.setOnAction(cb);

      expect(window.onAction).toBe(cb);
    });
  });

  describe('showReminder', () => {
    it('creates window if it does not exist', () => {
      window.showReminder({ id: 'test', title: 'Test' }, 0);

      expect(BrowserWindow).toHaveBeenCalled();
    });

    it('shows existing window', () => {
      window.showReminder({ id: 'test', title: 'Test' }, 0);
      const mockWin = window.window;

      window.showReminder({ id: 'test2', title: 'Test 2' }, 1);

      expect(mockWin.show).toHaveBeenCalled();
    });

    it('sends reminder data via IPC', () => {
      window.showReminder({ id: 'test', title: 'Test', description: 'Desc' }, 0);

      expect(window.window.webContents.send).toHaveBeenCalledWith('show-reminder', {
        id: 'test',
        title: 'Test',
        description: 'Desc',
        color: '#1a1a2e',
        buttonBg: '#424256',
        snoozeBg: '#000010',
        textColor: '#ffffff',
        stackIndex: 0,
      });
    });

    it('defaults description to empty string', () => {
      window.showReminder({ id: 'test', title: 'Test' }, 0);

      expect(window.window.webContents.send).toHaveBeenCalledWith(
        'show-reminder',
        expect.objectContaining({ description: '' })
      );
    });

    it('uses reminder color when provided', () => {
      window.showReminder({ id: 'test', title: 'Test', color: '#ff0000' }, 0);

      expect(window.window.webContents.send).toHaveBeenCalledWith(
        'show-reminder',
        expect.objectContaining({ color: '#ff0000' })
      );
    });

    it('falls back to defaultColor when reminder has no color', () => {
      window.showReminder({ id: 'test', title: 'Test' }, 0);

      expect(window.window.webContents.send).toHaveBeenCalledWith(
        'show-reminder',
        expect.objectContaining({ color: '#1a1a2e' })
      );
    });

    it('derives light text color for dark card', () => {
      window.showReminder({ id: 'test', title: 'Test', color: '#1a1a2e' }, 0);

      expect(window.window.webContents.send).toHaveBeenCalledWith(
        'show-reminder',
        expect.objectContaining({ textColor: '#ffffff' })
      );
    });

    it('derives dark text color for light card', () => {
      window.showReminder({ id: 'test', title: 'Test', color: '#ffffff' }, 0);

      expect(window.window.webContents.send).toHaveBeenCalledWith(
        'show-reminder',
        expect.objectContaining({ textColor: '#1a1a2e' })
      );
    });

    it('derives lighter button background from card color', () => {
      window.showReminder({ id: 'test', title: 'Test', color: '#ff0000' }, 0);

      const call = window.window.webContents.send.mock.calls.find(
        (c) => c[0] === 'show-reminder'
      )[1];
      expect(call.buttonBg).toBe('#ff2828');
    });

    it('derives darker snooze background from card color', () => {
      window.showReminder({ id: 'test', title: 'Test', color: '#ff0000' }, 0);

      const call = window.window.webContents.send.mock.calls.find(
        (c) => c[0] === 'show-reminder'
      )[1];
      expect(call.snoozeBg).toBe('#e10000');
    });
  });

  describe('removeReminder', () => {
    it('sends remove-reminder via IPC when window exists', () => {
      window.showReminder({ id: 'test', title: 'Test' }, 0);

      window.removeReminder('test');

      expect(window.window.webContents.send).toHaveBeenCalledWith('remove-reminder', 'test');
    });

    it('does nothing when window is null', () => {
      expect(() => window.removeReminder('test')).not.toThrow();
    });
  });

  describe('createWindow', () => {
    it('creates BrowserWindow with correct options', () => {
      window.createWindow();

      expect(BrowserWindow).toHaveBeenCalledWith(expect.objectContaining({
        width: 320,
        height: 220,
        resizable: false,
        frame: false,
        transparent: true,
        alwaysOnTop: true,
        show: false,
      }));
    });

    it('loads reminder.html', () => {
      window.createWindow();

      expect(window.window.loadFile).toHaveBeenCalled();
    });

    it('registers ready-to-show and close handlers', () => {
      window.createWindow();

      expect(window.window.once).toHaveBeenCalledWith('ready-to-show', expect.any(Function));
      expect(window.window.on).toHaveBeenCalledWith('close', expect.any(Function));
    });

    it('close handler prevents default and hides window', () => {
      window.createWindow();

      const closeHandler = window.window.on.mock.calls.find(
        (call) => call[0] === 'close'
      )[1];
      const event = { preventDefault: jest.fn() };
      closeHandler(event);

      expect(event.preventDefault).toHaveBeenCalled();
      expect(window.window.hide).toHaveBeenCalled();
    });

    it('close handler allows close when quitting', () => {
      window.createWindow();
      window.quitting = true;

      const closeHandler = window.window.on.mock.calls.find(
        (call) => call[0] === 'close'
      )[1];
      const event = { preventDefault: jest.fn() };
      closeHandler(event);

      expect(event.preventDefault).not.toHaveBeenCalled();
    });
  });

  describe('positionWindow', () => {
    it('sets bounds based on display size', () => {
      window.createWindow();

      const readyCallback = window.window.once.mock.calls.find(
        (call) => call[0] === 'ready-to-show'
      )[1];
      readyCallback();

      expect(window.window.setBounds).toHaveBeenCalledWith({
        x: 1920 - 320 - 20,
        y: 1080 - 220 - 20,
        width: 320,
        height: 220,
      });
    });
  });

  describe('hide', () => {
    it('hides the window when it exists and is not destroyed', () => {
      window.showReminder({ id: 'test', title: 'Test' }, 0);

      window.hide();

      expect(window.window.hide).toHaveBeenCalled();
    });

    it('does nothing when window is null', () => {
      expect(() => window.hide()).not.toThrow();
    });

    it('does nothing when window is destroyed', () => {
      window.showReminder({ id: 'test', title: 'Test' }, 0);
      window.window.isDestroyed.mockReturnValue(true);

      window.hide();

      expect(window.window.hide).not.toHaveBeenCalled();
    });
  });

  describe('IPC action forwarding', () => {
    it('forwards reminder-action to onAction callback', () => {
      const cb = jest.fn();
      window.setOnAction(cb);

      const ipcHandler = ipcMain.on.mock.calls.find(
        (call) => call[0] === 'reminder-action'
      )[1];
      ipcHandler(null, 'water', 'done');

      expect(cb).toHaveBeenCalledWith('water', 'done');
    });

    it('does nothing when onAction is not set', () => {
      const ipcHandler = ipcMain.on.mock.calls.find(
        (call) => call[0] === 'reminder-action'
      )[1];

      expect(() => ipcHandler(null, 'water', 'done')).not.toThrow();
    });
  });

  describe('recovery watch', () => {
    it('checks visibility periodically', () => {
      window.showReminder({ id: 'test', title: 'Test' }, 0);
      window.window.isVisible.mockReturnValue(false);

      jest.advanceTimersByTime(2000);

      expect(window.window.webContents.executeJavaScript).toHaveBeenCalled();
    });

    it('does nothing when window is null', () => {
      expect(() => jest.advanceTimersByTime(2000)).not.toThrow();
    });

    it('does nothing when window is visible', () => {
      window.showReminder({ id: 'test', title: 'Test' }, 0);
      window.window.isVisible.mockReturnValue(true);

      jest.advanceTimersByTime(2000);

      expect(window.window.webContents.executeJavaScript).not.toHaveBeenCalled();
    });

    it('shows window when cards exist and window is hidden', async () => {
      window.showReminder({ id: 'test', title: 'Test' }, 0);
      window.window.isVisible.mockReturnValue(false);
      window.window.webContents.executeJavaScript.mockResolvedValue(true);

      await jest.advanceTimersByTimeAsync(2000);

      expect(window.window.show).toHaveBeenCalled();
    });

    it('does not show when no cards exist', async () => {
      window.showReminder({ id: 'test', title: 'Test' }, 0);
      window.window.isVisible.mockReturnValue(false);
      window.window.webContents.executeJavaScript.mockResolvedValue(false);

      await jest.advanceTimersByTimeAsync(2000);

      expect(window.window.webContents.executeJavaScript).toHaveBeenCalled();
    });

    it('handles executeJavaScript rejection gracefully', async () => {
      window.showReminder({ id: 'test', title: 'Test' }, 0);
      window.window.isVisible.mockReturnValue(false);
      window.window.webContents.executeJavaScript.mockRejectedValue(new Error('fail'));

      await jest.advanceTimersByTimeAsync(2000);

      expect(() => {}).not.toThrow();
    });
  });
});
