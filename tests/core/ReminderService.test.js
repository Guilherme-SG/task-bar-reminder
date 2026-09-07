const ReminderService = require('../../src/core/ReminderService');

describe('ReminderService', () => {
  let service;
  let mockScheduler;
  let mockReminderWindow;
  let mockStateStore;
  let mockAudioPlayer;
  let config;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    mockScheduler = {
      getNextFireTime: jest.fn(),
    };

    mockReminderWindow = {
      showReminder: jest.fn(),
      hide: jest.fn(),
      removeReminder: jest.fn(),
    };

    mockStateStore = {
      getNextFireTime: jest.fn(),
      setNextFireTime: jest.fn().mockResolvedValue(undefined),
    };

    mockAudioPlayer = {
      pickRandom: jest.fn(),
      play: jest.fn().mockResolvedValue(undefined),
    };

    config = {
      reminders: [
        { id: 'water', title: 'Drink Water', cron: '*/40 * * * *' },
        { id: 'break', title: 'Take Break', cron: '0 10 * * *' },
      ],
      snoozeInterval: 300000,
      autoSnoozeTimeout: 60000,
    };

    service = new ReminderService({
      scheduler: mockScheduler,
      reminderWindow: mockReminderWindow,
      stateStore: mockStateStore,
      audioPlayer: mockAudioPlayer,
      config,
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('start', () => {
    it('initializes all reminders from config', async () => {
      mockStateStore.getNextFireTime.mockResolvedValue(null);
      mockScheduler.getNextFireTime
        .mockReturnValueOnce(new Date(Date.now() + 60000))
        .mockReturnValueOnce(new Date(Date.now() + 120000));

      await service.start();

      expect(mockStateStore.setNextFireTime).toHaveBeenCalledTimes(2);
    });

    it('fires immediately when saved time is in the past', async () => {
      mockStateStore.getNextFireTime.mockResolvedValue('2020-01-01T00:00:00Z');
      mockScheduler.getNextFireTime.mockReturnValue(new Date(Date.now() + 60000));
      mockAudioPlayer.pickRandom.mockReturnValue(null);

      await service.start();

      expect(mockReminderWindow.showReminder).toHaveBeenCalled();
    });

    it('schedules timeout for saved future time', async () => {
      const futureTime = new Date(Date.now() + 60000);
      mockStateStore.getNextFireTime.mockResolvedValue(futureTime.toISOString());

      await service.start();

      expect(mockStateStore.setNextFireTime).not.toHaveBeenCalled();
    });
  });

  describe('resolveReminder', () => {
    it('plays done sound on done action', () => {
      mockAudioPlayer.pickRandom.mockReturnValue('/sounds/water-done-1.mp3');

      service.resolveReminder('water', 'done');

      expect(mockAudioPlayer.pickRandom).toHaveBeenCalledWith('water', 'done');
      expect(mockAudioPlayer.play).toHaveBeenCalledWith('/sounds/water-done-1.mp3');
    });

    it('hides window on done', () => {
      mockAudioPlayer.pickRandom.mockReturnValue(null);

      service.resolveReminder('water', 'done');

      expect(mockReminderWindow.hide).toHaveBeenCalled();
    });

    it('skips done sound when pickRandom returns null', () => {
      mockAudioPlayer.pickRandom.mockReturnValue(null);

      service.resolveReminder('water', 'done');

      expect(mockAudioPlayer.play).not.toHaveBeenCalled();
    });

    it('plays snooze sound on snooze action', () => {
      mockAudioPlayer.pickRandom.mockReturnValue('/sounds/water-snooze-1.mp3');

      service.resolveReminder('water', 'snooze');

      expect(mockAudioPlayer.pickRandom).toHaveBeenCalledWith('water', 'snooze');
      expect(mockAudioPlayer.play).toHaveBeenCalledWith('/sounds/water-snooze-1.mp3');
    });

    it('skips snooze sound when pickRandom returns null', () => {
      mockAudioPlayer.pickRandom.mockReturnValue(null);

      service.resolveReminder('water', 'snooze');

      expect(mockAudioPlayer.play).not.toHaveBeenCalled();
    });

    it('schedules next timeout on snooze', () => {
      mockAudioPlayer.pickRandom.mockReturnValue(null);

      service.resolveReminder('water', 'snooze');

      expect(service.activeReminders.has('timeout_water')).toBe(true);
    });

    it('hides window on snooze', () => {
      mockAudioPlayer.pickRandom.mockReturnValue(null);

      service.resolveReminder('water', 'snooze');

      expect(mockReminderWindow.hide).toHaveBeenCalled();
    });

    it('does nothing for unknown reminder id', () => {
      service.resolveReminder('nonexistent', 'done');

      expect(mockAudioPlayer.pickRandom).not.toHaveBeenCalled();
    });

    it('does nothing for unknown action', () => {
      service.resolveReminder('water', 'unknown');

      expect(mockAudioPlayer.pickRandom).not.toHaveBeenCalled();
    });

    it('removes card from window on resolve', () => {
      service.resolveReminder('water', 'done');

      expect(mockReminderWindow.removeReminder).toHaveBeenCalledWith('water');
    });

    it('removes card from window on snooze', () => {
      service.resolveReminder('water', 'snooze');

      expect(mockReminderWindow.removeReminder).toHaveBeenCalledWith('water');
    });

    it('done sound stops current alarm', () => {
      mockAudioPlayer.pickRandom.mockReturnValue('/sounds/water-done-1.mp3');

      service.resolveReminder('water', 'done');

      expect(mockAudioPlayer.play).toHaveBeenCalledWith('/sounds/water-done-1.mp3');
      expect(mockReminderWindow.hide).toHaveBeenCalled();
    });
  });

  describe('getShownReminders', () => {
    it('returns empty array when no reminders are shown', () => {
      expect(service.getShownReminders()).toEqual([]);
    });

    it('returns shown reminders after firing', async () => {
      mockStateStore.getNextFireTime
        .mockResolvedValueOnce('2020-01-01T00:00:00Z')
        .mockResolvedValueOnce(null);
      mockScheduler.getNextFireTime.mockReturnValue(new Date(Date.now() + 60000));
      mockAudioPlayer.pickRandom.mockReturnValue(null);

      await service.start();

      expect(service.getShownReminders()).toEqual([
        { id: 'water', title: 'Drink Water' },
      ]);
    });

    it('removes reminder from shown after resolve', async () => {
      mockStateStore.getNextFireTime
        .mockResolvedValueOnce('2020-01-01T00:00:00Z')
        .mockResolvedValueOnce(null);
      mockScheduler.getNextFireTime.mockReturnValue(new Date(Date.now() + 60000));
      mockAudioPlayer.pickRandom.mockReturnValue(null);

      await service.start();
      expect(service.getShownReminders()).toHaveLength(1);

      service.resolveReminder('water', 'done');
      expect(service.getShownReminders()).toHaveLength(0);
    });
  });

  describe('onShow and onDismiss callbacks', () => {
    it('calls onShow when reminder fires', async () => {
      const onShow = jest.fn();
      service.onShow = onShow;

      mockStateStore.getNextFireTime.mockResolvedValue('2020-01-01T00:00:00Z');
      mockScheduler.getNextFireTime.mockReturnValue(new Date(Date.now() + 60000));
      mockAudioPlayer.pickRandom.mockReturnValue(null);

      await service.start();

      expect(onShow).toHaveBeenCalledWith([
        { id: 'water', title: 'Drink Water' },
      ]);
    });

    it('calls onDismiss when reminder is resolved', async () => {
      const onDismiss = jest.fn();
      service.onDismiss = onDismiss;

      mockStateStore.getNextFireTime
        .mockResolvedValueOnce('2020-01-01T00:00:00Z')
        .mockResolvedValueOnce(null);
      mockScheduler.getNextFireTime.mockReturnValue(new Date(Date.now() + 60000));
      mockAudioPlayer.pickRandom.mockReturnValue(null);

      await service.start();
      service.resolveReminder('water', 'done');

      expect(onDismiss).toHaveBeenCalledWith([]);
    });

    it('does not throw when callbacks are not set', async () => {
      mockStateStore.getNextFireTime.mockResolvedValue('2020-01-01T00:00:00Z');
      mockScheduler.getNextFireTime.mockReturnValue(new Date(Date.now() + 60000));
      mockAudioPlayer.pickRandom.mockReturnValue(null);

      await expect(service.start()).resolves.not.toThrow();
    });
  });

  describe('queue processing', () => {
    it('shows reminder simultaneously with alert sound', async () => {
      mockStateStore.getNextFireTime.mockResolvedValue(null);
      mockScheduler.getNextFireTime.mockReturnValue(new Date(Date.now() + 60000));
      mockAudioPlayer.pickRandom.mockReturnValue('/sounds/water-alert-1.mp3');

      await service.start();

      await jest.advanceTimersByTimeAsync(60000);

      expect(mockAudioPlayer.play).toHaveBeenCalledWith('/sounds/water-alert-1.mp3');
      expect(mockReminderWindow.showReminder).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'water' }),
        expect.any(Number)
      );
    });

    it('skips alert sound when pickRandom returns null', async () => {
      mockStateStore.getNextFireTime.mockResolvedValue(null);
      mockScheduler.getNextFireTime.mockReturnValue(new Date(Date.now() + 60000));
      mockAudioPlayer.pickRandom.mockReturnValue(null);

      await service.start();

      await jest.advanceTimersByTimeAsync(60000);

      expect(mockReminderWindow.showReminder).toHaveBeenCalled();
      expect(mockAudioPlayer.play).not.toHaveBeenCalled();
    });

    it('new alert stops previous alarm sound', async () => {
      service.config.reminders = [
        { id: 'water', title: 'Drink Water', cron: '*/40 * * * *' },
        { id: 'break', title: 'Take Break', cron: '*/40 * * * *' },
      ];
      mockStateStore.getNextFireTime.mockResolvedValue(null);
      mockScheduler.getNextFireTime.mockReturnValue(new Date(Date.now() + 60000));
      mockAudioPlayer.pickRandom
        .mockReturnValueOnce('/sounds/water-alert-1.mp3')
        .mockReturnValueOnce('/sounds/break-alert-1.mp3');

      await service.start();

      await jest.advanceTimersByTimeAsync(60000);

      expect(mockAudioPlayer.play).toHaveBeenCalledTimes(2);
      expect(mockAudioPlayer.play).toHaveBeenNthCalledWith(1, '/sounds/water-alert-1.mp3');
      expect(mockAudioPlayer.play).toHaveBeenNthCalledWith(2, '/sounds/break-alert-1.mp3');
      expect(mockReminderWindow.showReminder).toHaveBeenCalledTimes(2);
    });

    it('shows multiple reminder windows simultaneously', async () => {
      service.config.reminders = [
        { id: 'water', title: 'Drink Water', cron: '*/40 * * * *' },
        { id: 'break', title: 'Take Break', cron: '*/40 * * * *' },
      ];
      mockStateStore.getNextFireTime.mockResolvedValue(null);
      mockScheduler.getNextFireTime.mockReturnValue(new Date(Date.now() + 60000));
      mockAudioPlayer.pickRandom.mockReturnValue(null);

      await service.start();

      await jest.advanceTimersByTimeAsync(60000);

      expect(mockReminderWindow.showReminder).toHaveBeenCalledTimes(2);
      expect(mockReminderWindow.showReminder).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'water' }),
        expect.any(Number)
      );
      expect(mockReminderWindow.showReminder).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'break' }),
        expect.any(Number)
      );
    });

    it('snoozes previous when same reminder fires again before resolved', async () => {
      service.config = {
        reminders: [{ id: 'water', title: 'Drink Water', cron: '*/40 * * * *' }],
        snoozeInterval: 300000,
      };
      mockStateStore.getNextFireTime.mockResolvedValue(null);
      mockScheduler.getNextFireTime.mockImplementation(
        () => new Date(Date.now() + 60000)
      );
      mockAudioPlayer.pickRandom.mockReturnValue(null);

      await service.start();

      await jest.advanceTimersByTimeAsync(60000);
      expect(service.shownReminders.has('water')).toBe(true);
      expect(mockReminderWindow.showReminder).toHaveBeenCalledTimes(1);

      await jest.advanceTimersByTimeAsync(60000);

      expect(service.activeReminders.has('timeout_water')).toBe(true);
      expect(mockReminderWindow.showReminder).toHaveBeenCalledTimes(2);
    });
  });

  describe('scheduleNext', () => {
    it('clears existing timeout before setting new one', async () => {
      mockStateStore.getNextFireTime.mockResolvedValue(null);
      mockScheduler.getNextFireTime.mockReturnValue(new Date(Date.now() + 60000));

      await service.start();

      expect(service.activeReminders.has('timeout_water')).toBe(true);
    });

    it('replaces existing timeout when scheduling same reminder again', () => {
      mockAudioPlayer.pickRandom.mockReturnValue(null);
      mockScheduler.getNextFireTime.mockReturnValue(new Date(Date.now() + 60000));

      service.resolveReminder('water', 'snooze');
      const firstTimeout = service.activeReminders.get('timeout_water');

      service.resolveReminder('water', 'snooze');
      const secondTimeout = service.activeReminders.get('timeout_water');

      expect(firstTimeout).not.toBe(secondTimeout);
    });
  });

  describe('per-reminder snoozeInterval', () => {
    it('uses per-reminder snoozeInterval over global', () => {
      service.config.reminders[0].snoozeInterval = 120000;
      mockAudioPlayer.pickRandom.mockReturnValue(null);

      service.resolveReminder('water', 'snooze');

      expect(service.activeReminders.has('timeout_water')).toBe(true);
    });

    it('falls back to global snoozeInterval when not set on reminder', () => {
      mockAudioPlayer.pickRandom.mockReturnValue(null);

      service.resolveReminder('water', 'snooze');

      expect(service.activeReminders.has('timeout_water')).toBe(true);
    });
  });

  describe('autoSnoozeTimeout', () => {
    it('auto-dismisses popup after timeout', async () => {
      service.config.reminders[0].autoSnoozeTimeout = 5000;
      mockStateStore.getNextFireTime.mockResolvedValue('2020-01-01T00:00:00Z');
      mockScheduler.getNextFireTime.mockReturnValue(new Date(Date.now() + 60000));
      mockAudioPlayer.pickRandom.mockReturnValue(null);

      await service.start();

      await jest.advanceTimersByTimeAsync(5000);

      expect(mockReminderWindow.hide).toHaveBeenCalled();
      expect(service.shownReminders.has('water')).toBe(false);
    });

    it('does not auto-dismiss when autoSnoozeTimeout is 0', async () => {
      service.config.reminders[0].autoSnoozeTimeout = 0;
      mockStateStore.getNextFireTime.mockResolvedValue('2020-01-01T00:00:00Z');
      mockScheduler.getNextFireTime.mockReturnValue(new Date(Date.now() + 60000));
      mockAudioPlayer.pickRandom.mockReturnValue(null);

      await service.start();

      await jest.advanceTimersByTimeAsync(10000);

      expect(mockReminderWindow.hide).not.toHaveBeenCalled();
      expect(service.shownReminders.has('water')).toBe(true);
    });

    it('cancels auto-dismiss when reminder is resolved manually', async () => {
      service.config.reminders[0].autoSnoozeTimeout = 5000;
      mockStateStore.getNextFireTime.mockResolvedValue('2020-01-01T00:00:00Z');
      mockScheduler.getNextFireTime.mockReturnValue(new Date(Date.now() + 60000));
      mockAudioPlayer.pickRandom.mockReturnValue(null);

      await service.start();

      service.resolveReminder('water', 'done');

      expect(service.autoDismissTimers.has('water')).toBe(false);

      await jest.advanceTimersByTimeAsync(5000);

      expect(mockReminderWindow.hide).toHaveBeenCalledTimes(1);
    });

    it('uses per-reminder autoSnoozeTimeout over global', async () => {
      service.config.reminders[0].autoSnoozeTimeout = 3000;
      mockStateStore.getNextFireTime.mockResolvedValue('2020-01-01T00:00:00Z');
      mockScheduler.getNextFireTime.mockReturnValue(new Date(Date.now() + 60000));
      mockAudioPlayer.pickRandom.mockReturnValue(null);

      await service.start();

      await jest.advanceTimersByTimeAsync(3000);

      expect(mockReminderWindow.hide).toHaveBeenCalled();
    });
  });
});
