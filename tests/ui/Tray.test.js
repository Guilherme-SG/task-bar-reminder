jest.mock('electron', () => {
  const mockTray = {
    setToolTip: jest.fn(),
    setContextMenu: jest.fn(),
  };
  return {
    Tray: jest.fn(() => mockTray),
    Menu: {
      buildFromTemplate: jest.fn((items) => ({ items })),
    },
    app: {
      quit: jest.fn(),
    },
  };
});

const { Tray, Menu, app } = require('electron');
const AppTray = require('../../src/ui/Tray');

describe('AppTray', () => {
  let tray;

  beforeEach(() => {
    jest.clearAllMocks();
    tray = new AppTray();
  });

  describe('create', () => {
    it('creates a tray with icon and tooltip', () => {
      tray.create();

      expect(Tray).toHaveBeenCalled();
      expect(tray.tray.setToolTip).toHaveBeenCalledWith('Desktop Reminder');
    });

    it('creates initial empty menu', () => {
      tray.create();

      expect(Menu.buildFromTemplate).toHaveBeenCalled();
      expect(tray.tray.setContextMenu).toHaveBeenCalled();
    });
  });

  describe('setOnAction', () => {
    it('stores the callback', () => {
      const cb = jest.fn();
      tray.setOnAction(cb);

      expect(tray.onAction).toBe(cb);
    });
  });

  describe('updateMenu', () => {
    beforeEach(() => {
      tray.create();
      Menu.buildFromTemplate.mockClear();
    });

    it('creates menu with reminder items and Sair', () => {
      tray.updateMenu([
        { id: 'water', title: 'Drink Water' },
        { id: 'break', title: 'Take Break' },
      ]);

      const call = Menu.buildFromTemplate.mock.calls[0][0];
      expect(call).toHaveLength(4); // 2 reminders + separator + Sair
      expect(call[0].label).toContain('Drink Water');
      expect(call[1].label).toContain('Take Break');
      expect(call[2].type).toBe('separator');
      expect(call[3].label).toBe('Sair');
    });

    it('creates menu with only Sair when no reminders', () => {
      tray.updateMenu([]);

      const call = Menu.buildFromTemplate.mock.calls[0][0];
      expect(call).toHaveLength(1);
      expect(call[0].label).toBe('Sair');
    });

    it('calls onAction when reminder item is clicked', () => {
      const cb = jest.fn();
      tray.setOnAction(cb);

      tray.updateMenu([{ id: 'water', title: 'Drink Water' }]);

      const call = Menu.buildFromTemplate.mock.calls[0][0];
      call[0].click();

      expect(cb).toHaveBeenCalledWith('water', 'fire-now');
    });

    it('does not throw when onAction is not set', () => {
      tray.updateMenu([{ id: 'water', title: 'Drink Water' }]);

      const call = Menu.buildFromTemplate.mock.calls[0][0];
      expect(() => call[0].click()).not.toThrow();
    });

    it('Sair item calls app.quit', () => {
      tray.updateMenu([]);

      const call = Menu.buildFromTemplate.mock.calls[0][0];
      call[0].click();

      expect(app.quit).toHaveBeenCalled();
    });
  });
});
