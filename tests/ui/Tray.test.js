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
      relaunch: jest.fn(),
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

    it('shows Add new reminder, Add one-time reminder, Manage reminders, Open sounds folder, Settings, Restart and Exit when no active reminders', () => {
      tray.updateMenu(
        [{ id: 'water', title: 'Drink Water' }],
        []
      );

      const call = Menu.buildFromTemplate.mock.calls[0][0];
      expect(call).toHaveLength(8);
      expect(call[0].label).toBe('Add new reminder');
      expect(call[1].label).toBe('Add one-time reminder');
      expect(call[2].label).toBe('Manage reminders');
      expect(call[3].label).toBe('Open sounds folder');
      expect(call[4].type).toBe('separator');
      expect(call[5].label).toBe('Settings');
      expect(call[6].label).toBe('Restart');
      expect(call[7].label).toBe('Exit');
    });

    it('shows Done and Snooze for active reminders', () => {
      tray.updateMenu(
        [{ id: 'water', title: 'Drink Water' }],
        [{ id: 'water', pending: false }]
      );

      const call = Menu.buildFromTemplate.mock.calls[0][0];
      expect(call).toHaveLength(11);
      expect(call[0].label).toBe('Done - "Drink Water"');
      expect(call[1].label).toBe('Snooze - "Drink Water"');
      expect(call[2].type).toBe('separator');
      expect(call[3].label).toBe('Add new reminder');
      expect(call[4].label).toBe('Add one-time reminder');
      expect(call[5].label).toBe('Manage reminders');
      expect(call[6].label).toBe('Open sounds folder');
      expect(call[7].type).toBe('separator');
      expect(call[8].label).toBe('Settings');
      expect(call[9].label).toBe('Restart');
      expect(call[10].label).toBe('Exit');
    });

    it('mixes active and inactive reminders', () => {
      tray.updateMenu(
        [
          { id: 'water', title: 'Drink Water' },
          { id: 'break', title: 'Take Break' },
        ],
        [{ id: 'water', pending: false }]
      );

      const call = Menu.buildFromTemplate.mock.calls[0][0];
      expect(call[0].label).toBe('Done - "Drink Water"');
      expect(call[1].label).toBe('Snooze - "Drink Water"');
      expect(call[2].type).toBe('separator');
      expect(call[3].label).toBe('Add new reminder');
      expect(call[4].label).toBe('Add one-time reminder');
      expect(call[5].label).toBe('Manage reminders');
      expect(call[6].label).toBe('Open sounds folder');
      expect(call[7].type).toBe('separator');
      expect(call[8].label).toBe('Settings');
      expect(call[9].label).toBe('Restart');
      expect(call[10].label).toBe('Exit');
    });

    it('marks pending reminders in the labels', () => {
      tray.updateMenu(
        [{ id: 'water', title: 'Drink Water' }],
        [{ id: 'water', pending: true }]
      );

      const call = Menu.buildFromTemplate.mock.calls[0][0];
      expect(call).toHaveLength(11);
      expect(call[0].label).toBe('Done - "Drink Water" (pending)');
      expect(call[1].label).toBe('Snooze - "Drink Water" (pending)');
    });

    it('calls onAction with done when Done is clicked', () => {
      const cb = jest.fn();
      tray.setOnAction(cb);

      tray.updateMenu(
        [{ id: 'water', title: 'Drink Water' }],
        [{ id: 'water', pending: false }]
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
        [{ id: 'water', pending: false }]
      );

      const call = Menu.buildFromTemplate.mock.calls[0][0];
      call[1].click();

      expect(cb).toHaveBeenCalledWith('water', 'snooze');
    });

    it('does not throw when onAction is not set', () => {
      tray.updateMenu(
        [{ id: 'water', title: 'Drink Water' }],
        [{ id: 'water', pending: false }]
      );

      const call = Menu.buildFromTemplate.mock.calls[0][0];
      expect(() => call[0].click()).not.toThrow();
      expect(() => call[1].click()).not.toThrow();
    });

    it('calls onAddReminder when Add new reminder is clicked', () => {
      const onAdd = jest.fn();
      tray.onAddReminder = onAdd;

      tray.updateMenu([], []);

      const call = Menu.buildFromTemplate.mock.calls[0][0];
      call[0].click();

      expect(onAdd).toHaveBeenCalled();
    });

    it('does not throw when onAddReminder is not set', () => {
      tray.updateMenu([], []);

      const call = Menu.buildFromTemplate.mock.calls[0][0];
      expect(() => call[0].click()).not.toThrow();
    });

    it('calls onManageReminders when Manage reminders is clicked', () => {
      const onManage = jest.fn();
      tray.onManageReminders = onManage;

      tray.updateMenu([], []);

      const call = Menu.buildFromTemplate.mock.calls[0][0];
      call[2].click();

      expect(onManage).toHaveBeenCalled();
    });

    it('does not throw when onManageReminders is not set', () => {
      tray.updateMenu([], []);

      const call = Menu.buildFromTemplate.mock.calls[0][0];
      expect(() => call[2].click()).not.toThrow();
    });

    it('calls onOpenSounds when Open sounds folder is clicked', () => {
      const onOpen = jest.fn();
      tray.onOpenSounds = onOpen;

      tray.updateMenu([], []);

      const call = Menu.buildFromTemplate.mock.calls[0][0];
      call[3].click();

      expect(onOpen).toHaveBeenCalled();
    });

    it('does not throw when onOpenSounds is not set', () => {
      tray.updateMenu([], []);

      const call = Menu.buildFromTemplate.mock.calls[0][0];
      expect(() => call[3].click()).not.toThrow();
    });

    it('calls onQuit when Exit is clicked', () => {
      const onQuit = jest.fn();
      tray.onQuit = onQuit;

      tray.updateMenu([], []);

      const call = Menu.buildFromTemplate.mock.calls[0][0];
      call[7].click();

      expect(onQuit).toHaveBeenCalled();
    });

    it('calls app.quit when onQuit not set', () => {
      tray.updateMenu([], []);

      const call = Menu.buildFromTemplate.mock.calls[0][0];
      call[7].click();

      expect(app.quit).toHaveBeenCalled();
    });

    it('defaults activeReminders to empty when not provided', () => {
      tray.updateMenu([{ id: 'water', title: 'Drink Water' }]);

      const call = Menu.buildFromTemplate.mock.calls[0][0];
      expect(call).toHaveLength(8);
      expect(call[0].label).toBe('Add new reminder');
      expect(call[1].label).toBe('Add one-time reminder');
      expect(call[2].label).toBe('Manage reminders');
      expect(call[3].label).toBe('Open sounds folder');
      expect(call[4].type).toBe('separator');
      expect(call[5].label).toBe('Settings');
      expect(call[6].label).toBe('Restart');
      expect(call[7].label).toBe('Exit');
    });

    it('calls onRestart when Restart is clicked', () => {
      const onRestart = jest.fn();
      tray.onRestart = onRestart;

      tray.updateMenu([], []);

      const call = Menu.buildFromTemplate.mock.calls[0][0];
      call[6].click();

      expect(onRestart).toHaveBeenCalled();
    });

    it('does not throw when onRestart is not set', () => {
      tray.updateMenu([], []);

      const call = Menu.buildFromTemplate.mock.calls[0][0];
      expect(() => call[6].click()).not.toThrow();
    });

    it('calls onOpenSettings when Settings is clicked @spec:AC-004', () => {
      const onOpenSettings = jest.fn();
      tray.onOpenSettings = onOpenSettings;

      tray.updateMenu([], []);

      const call = Menu.buildFromTemplate.mock.calls[0][0];
      call[5].click();

      expect(onOpenSettings).toHaveBeenCalled();
    });

    it('does not throw when onOpenSettings is not set @spec:AC-004', () => {
      tray.updateMenu([], []);

      const call = Menu.buildFromTemplate.mock.calls[0][0];
      expect(() => call[5].click()).not.toThrow();
    });

    it('calls onQuickReminder when Add one-time reminder is clicked @spec:AC-013', () => {
      const onQuickReminder = jest.fn();
      tray.onQuickReminder = onQuickReminder;

      tray.updateMenu([], []);

      const call = Menu.buildFromTemplate.mock.calls[0][0];
      call[1].click();

      expect(onQuickReminder).toHaveBeenCalled();
    });

    it('does not throw when onQuickReminder is not set @spec:AC-013', () => {
      tray.updateMenu([], []);

      const call = Menu.buildFromTemplate.mock.calls[0][0];
      expect(() => call[1].click()).not.toThrow();
    });
  });
});
