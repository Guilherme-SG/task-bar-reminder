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

    it('shows only Sair when no active reminders', () => {
      tray.updateMenu(
        [{ id: 'water', title: 'Drink Water' }],
        []
      );

      const call = Menu.buildFromTemplate.mock.calls[0][0];
      expect(call).toHaveLength(1);
      expect(call[0].label).toBe('Sair');
    });

    it('shows Done and Snooze for active reminders', () => {
      tray.updateMenu(
        [{ id: 'water', title: 'Drink Water' }],
        ['water']
      );

      const call = Menu.buildFromTemplate.mock.calls[0][0];
      expect(call).toHaveLength(4);
      expect(call[0].label).toBe('Done - "Drink Water"');
      expect(call[1].label).toBe('Snooze - "Drink Water"');
      expect(call[2].type).toBe('separator');
      expect(call[3].label).toBe('Sair');
    });

    it('mixes active and inactive reminders', () => {
      tray.updateMenu(
        [
          { id: 'water', title: 'Drink Water' },
          { id: 'break', title: 'Take Break' },
        ],
        ['water']
      );

      const call = Menu.buildFromTemplate.mock.calls[0][0];
      expect(call[0].label).toBe('Done - "Drink Water"');
      expect(call[1].label).toBe('Snooze - "Drink Water"');
      expect(call[2].type).toBe('separator');
      expect(call[3].label).toBe('Sair');
    });

    it('calls onAction with done when Done is clicked', () => {
      const cb = jest.fn();
      tray.setOnAction(cb);

      tray.updateMenu(
        [{ id: 'water', title: 'Drink Water' }],
        ['water']
      );

      const call = Menu.buildFromTemplate.mock.calls[0][0];
      call[0].click();

      expect(cb).toHaveBeenCalledWith('water', 'done');
    });

    it('calls onAction with snooze when Snooze is clicked', () => {
      const cb = jest.fn();
      tray.setOnAction(cb);

      tray.updateMenu(
        [{ id: 'water', title: 'Drink Water' }],
        ['water']
      );

      const call = Menu.buildFromTemplate.mock.calls[0][0];
      call[1].click();

      expect(cb).toHaveBeenCalledWith('water', 'snooze');
    });

    it('does not throw when onAction is not set', () => {
      tray.updateMenu(
        [{ id: 'water', title: 'Drink Water' }],
        ['water']
      );

      const call = Menu.buildFromTemplate.mock.calls[0][0];
      expect(() => call[0].click()).not.toThrow();
      expect(() => call[1].click()).not.toThrow();
    });

    it('calls onQuit when Sair is clicked', () => {
      const onQuit = jest.fn();
      tray.onQuit = onQuit;

      tray.updateMenu([], []);

      const call = Menu.buildFromTemplate.mock.calls[0][0];
      call[0].click();

      expect(onQuit).toHaveBeenCalled();
    });

    it('calls app.quit when onQuit not set', () => {
      tray.updateMenu([], []);

      const call = Menu.buildFromTemplate.mock.calls[0][0];
      call[0].click();

      expect(app.quit).toHaveBeenCalled();
    });
    it('defaults activeIds to empty when not provided', () => {
      tray.updateMenu([{ id: 'water', title: 'Drink Water' }]);

      const call = Menu.buildFromTemplate.mock.calls[0][0];
      expect(call).toHaveLength(1);
      expect(call[0].label).toBe('Sair');
    });
  });
});
