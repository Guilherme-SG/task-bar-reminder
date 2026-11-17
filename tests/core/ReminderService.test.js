const ReminderService = require('../../src/core/ReminderService');

describe('ReminderService', () => {
  let service;
  let mockScheduler;
  let mockReminderWindow;
  let mockStateStore;
  let mockAudioPlayer;
  let mockFocusGuard;
  let config;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    mockScheduler = {
      getNextFireTime: jest.fn(),
      getInterval: jest.fn(),
    };

    mockReminderWindow = {
      showReminder: jest.fn(),
      hide: jest.fn(),
      removeReminder: jest.fn(),
    };

    mockStateStore = {
      getNextFireTime: jest.fn(),
      setNextFireTime: jest.fn().mockResolvedValue(undefined),
      clearNextFireTime: jest.fn().mockResolvedValue(undefined),
    };

    mockAudioPlayer = {
      pickRandom: jest.fn(),
      play: jest.fn().mockResolvedValue(undefined),
    };

    mockFocusGuard = {
      isBlocked: jest.fn().mockReturnValue(false),
      start: jest.fn(),
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
      focusGuard: mockFocusGuard,
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

      expect(mockStateStore.setNextFireTime).toHaveBeenCalledTimes(4);
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
      const offset = futureTime.getTimezoneOffset() * 60000;
      const local = new Date(futureTime.getTime() - offset);
      mockStateStore.getNextFireTime.mockResolvedValue(local.toISOString().slice(0, 19));

      await service.start();

      expect(service.activeReminders.has('timeout_water')).toBe(true);
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

    it('persists next fire time on snooze', () => {
      mockAudioPlayer.pickRandom.mockReturnValue(null);
      const before = Date.now();

      service.resolveReminder('water', 'snooze');

      expect(mockStateStore.setNextFireTime).toHaveBeenCalledWith(
        'water',
        expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/)
      );

      const savedTime = mockStateStore.setNextFireTime.mock.calls[0][1];
      const savedMs = new Date(savedTime).getTime();
      expect(savedMs).toBeGreaterThan(before);
      expect(savedMs).toBeLessThanOrEqual(before + 300000);
    });

    it('snooze schedules next fire using cron interval from now', async () => {
      mockAudioPlayer.pickRandom.mockReturnValue(null);
      const cronInterval = 40 * 60 * 1000;
      mockScheduler.getInterval.mockReturnValue(cronInterval);

      service.resolveReminder('water', 'snooze');

      await jest.advanceTimersByTimeAsync(300000);

      expect(mockScheduler.getInterval).toHaveBeenCalledWith('*/40 * * * *');
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

  describe('getActiveReminders', () => {
    it('returns empty array when no reminders are active', () => {
      expect(service.getActiveReminders()).toEqual([]);
    });

    it('returns shown reminders after firing', async () => {
      mockStateStore.getNextFireTime
        .mockResolvedValueOnce('2020-01-01T00:00:00Z')
        .mockResolvedValueOnce(null);
      mockScheduler.getNextFireTime.mockReturnValue(new Date(Date.now() + 60000));
      mockAudioPlayer.pickRandom.mockReturnValue(null);

      await service.start();

      expect(service.getActiveReminders()).toEqual([
        { id: 'water', title: 'Drink Water', pending: false },
      ]);
    });

    it('removes reminder from active after resolve', async () => {
      mockStateStore.getNextFireTime
        .mockResolvedValueOnce('2020-01-01T00:00:00Z')
        .mockResolvedValueOnce(null);
      mockScheduler.getNextFireTime.mockReturnValue(new Date(Date.now() + 60000));
      mockAudioPlayer.pickRandom.mockReturnValue(null);

      await service.start();
      expect(service.getActiveReminders()).toHaveLength(1);

      service.resolveReminder('water', 'done');
      expect(service.getActiveReminders()).toHaveLength(0);
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
        { id: 'water', title: 'Drink Water', pending: false },
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

  describe('focus blocking', () => {
    function configWithBlockedReminder() {
      service.config.blockWhenFocused = ['dota2'];
      service.config.reminders = [service.config.reminders[0]];
      mockStateStore.getNextFireTime.mockResolvedValue(null);
      mockScheduler.getNextFireTime.mockImplementation(
        () => new Date(Date.now() + 60000)
      );
      mockAudioPlayer.pickRandom.mockReturnValue(null);
    }

    it('defers a reminder and plays the alert sound when a blocked app is focused', async () => {
      configWithBlockedReminder();
      mockFocusGuard.isBlocked.mockReturnValue(true);
      mockAudioPlayer.pickRandom.mockReturnValue('/sounds/water-alert-1.mp3');

      await service.start();
      await jest.advanceTimersByTimeAsync(60000);

      expect(mockFocusGuard.isBlocked).toHaveBeenCalledWith(['dota2']);
      expect(mockAudioPlayer.play).toHaveBeenCalledWith('/sounds/water-alert-1.mp3');
      expect(mockReminderWindow.showReminder).not.toHaveBeenCalled();
      expect(service.shownReminders.has('water')).toBe(false);
      expect(service.deferredReminders.has('water')).toBe(true);
    });

    it('reports deferred reminders as pending to the tray', async () => {
      configWithBlockedReminder();
      mockFocusGuard.isBlocked.mockReturnValue(true);
      const onShow = jest.fn();
      service.onShow = onShow;

      await service.start();
      await jest.advanceTimersByTimeAsync(60000);

      expect(onShow).toHaveBeenCalledWith([
        { id: 'water', title: 'Drink Water', pending: true },
      ]);
    });

    it('uses a per-reminder list over the global list', async () => {
      configWithBlockedReminder();
      service.config.reminders[0].blockWhenFocused = ['eldenring'];

      await service.start();
      await jest.advanceTimersByTimeAsync(60000);

      expect(mockFocusGuard.isBlocked).toHaveBeenCalledWith(['eldenring']);
      expect(mockReminderWindow.showReminder).toHaveBeenCalled();
    });

    it('always shows when the per-reminder list is empty', async () => {
      configWithBlockedReminder();
      service.config.reminders[0].blockWhenFocused = [];
      mockFocusGuard.isBlocked.mockReturnValue(true);

      await service.start();
      await jest.advanceTimersByTimeAsync(60000);

      expect(mockFocusGuard.isBlocked).not.toHaveBeenCalled();
      expect(mockReminderWindow.showReminder).toHaveBeenCalled();
      expect(service.deferredReminders.has('water')).toBe(false);
    });

    it('shows deferred reminders when focus clears', async () => {
      configWithBlockedReminder();
      mockFocusGuard.isBlocked.mockReturnValueOnce(true).mockReturnValue(false);

      await service.start();
      await jest.advanceTimersByTimeAsync(60000);
      expect(service.deferredReminders.has('water')).toBe(true);

      service.releaseDeferredReminders();

      expect(service.deferredReminders.has('water')).toBe(false);
      expect(service.shownReminders.has('water')).toBe(true);
      expect(mockReminderWindow.showReminder).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'water' }),
        expect.any(Number)
      );
      expect(service.autoDismissTimers.has('water')).toBe(true);
    });

    it('keeps deferred reminders while the app is still focused', async () => {
      configWithBlockedReminder();
      mockFocusGuard.isBlocked.mockReturnValue(true);

      await service.start();
      await jest.advanceTimersByTimeAsync(60000);

      service.releaseDeferredReminders();

      expect(service.deferredReminders.has('water')).toBe(true);
      expect(mockReminderWindow.showReminder).not.toHaveBeenCalled();
    });

    it('does nothing when nothing is deferred', () => {
      service.releaseDeferredReminders();

      expect(mockReminderWindow.showReminder).not.toHaveBeenCalled();
    });

    it('does not replay the alert sound when releasing', async () => {
      configWithBlockedReminder();
      mockFocusGuard.isBlocked.mockReturnValueOnce(true).mockReturnValue(false);
      mockAudioPlayer.pickRandom.mockReturnValue('/sounds/water-alert-1.mp3');

      await service.start();
      await jest.advanceTimersByTimeAsync(60000);

      service.releaseDeferredReminders();

      expect(mockAudioPlayer.play).toHaveBeenCalledTimes(1);
    });

    it('releases only reminders whose block list no longer matches', async () => {
      service.config.blockWhenFocused = [];
      service.config.reminders = [
        { id: 'water', title: 'Drink Water', cron: '*/40 * * * *', blockWhenFocused: ['dota2'] },
        { id: 'break', title: 'Take Break', cron: '0 10 * * *', blockWhenFocused: ['eldenring'] },
      ];
      mockFocusGuard.isBlocked.mockReturnValue(true);
      mockStateStore.getNextFireTime.mockResolvedValue(null);
      mockScheduler.getNextFireTime.mockReturnValue(new Date(Date.now() + 60000));
      mockAudioPlayer.pickRandom.mockReturnValue(null);

      await service.start();
      await jest.advanceTimersByTimeAsync(60000);
      expect(service.deferredReminders.size).toBe(2);

      mockFocusGuard.isBlocked.mockImplementation((apps) => apps.includes('eldenring'));
      service.releaseDeferredReminders();

      expect(service.deferredReminders.has('water')).toBe(false);
      expect(service.deferredReminders.has('break')).toBe(true);
      expect(mockReminderWindow.showReminder).toHaveBeenCalledTimes(1);
      expect(mockReminderWindow.showReminder).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'water' }),
        expect.any(Number)
      );
    });

    it('deduplicates repeated fires while still blocked', async () => {
      configWithBlockedReminder();
      mockFocusGuard.isBlocked.mockReturnValue(true);
      mockAudioPlayer.pickRandom.mockReturnValue('/sounds/water-alert-1.mp3');

      await service.start();
      await jest.advanceTimersByTimeAsync(60000);
      await jest.advanceTimersByTimeAsync(60000);

      expect(service.deferredReminders.size).toBe(1);
      expect(mockAudioPlayer.play).toHaveBeenCalledTimes(2);
      expect(mockReminderWindow.showReminder).not.toHaveBeenCalled();
    });

    it('does not mark an already shown reminder as pending', async () => {
      configWithBlockedReminder();
      service.config.reminders[0].autoSnoozeTimeout = 0;
      mockFocusGuard.isBlocked.mockReturnValueOnce(false).mockReturnValue(true);

      await service.start();
      await jest.advanceTimersByTimeAsync(60000);
      expect(service.shownReminders.has('water')).toBe(true);

      await jest.advanceTimersByTimeAsync(60000);

      expect(service.deferredReminders.has('water')).toBe(true);
      expect(service.getActiveReminders()).toEqual([
        { id: 'water', title: 'Drink Water', pending: false },
      ]);
    });

    it('removes a pending reminder when resolved from the tray', async () => {
      configWithBlockedReminder();
      mockFocusGuard.isBlocked.mockReturnValue(true);

      await service.start();
      await jest.advanceTimersByTimeAsync(60000);
      expect(service.deferredReminders.has('water')).toBe(true);

      service.resolveReminder('water', 'done');

      expect(service.deferredReminders.has('water')).toBe(false);
      expect(service.shownReminders.has('water')).toBe(false);
      expect(mockReminderWindow.removeReminder).toHaveBeenCalledWith('water');
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

    it('passes grouped cron rules to the scheduler', async () => {
      service.config.reminders[0].cron = ['0 * * * *', '30 * * * *'];
      mockStateStore.getNextFireTime.mockResolvedValue(null);
      mockScheduler.getNextFireTime.mockReturnValue(new Date(Date.now() + 60000));

      await service.start();

      expect(mockScheduler.getNextFireTime).toHaveBeenCalledWith(['0 * * * *', '30 * * * *']);
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

  describe('addReminder', () => {
    it('adds reminder to config and schedules it', async () => {
      mockStateStore.getNextFireTime.mockResolvedValue(null);
      mockScheduler.getNextFireTime.mockReturnValue(new Date(Date.now() + 60000));

      const newReminder = { id: 'exercise', title: 'Exercise', cron: '0 12 * * *' };
      await service.addReminder(newReminder);

      expect(service.config.reminders).toContainEqual(newReminder);
      expect(mockStateStore.setNextFireTime).toHaveBeenCalledWith('exercise', expect.any(String));
      expect(mockFocusGuard.start).not.toHaveBeenCalled();
    });

    it('starts focus guard if new reminder has blockWhenFocused', async () => {
      mockStateStore.getNextFireTime.mockResolvedValue(null);
      mockScheduler.getNextFireTime.mockReturnValue(new Date(Date.now() + 60000));

      const newReminder = {
        id: 'stretch',
        title: 'Stretch',
        cron: '0 14 * * *',
        blockWhenFocused: ['game'],
      };
      await service.addReminder(newReminder);

      expect(mockFocusGuard.start).toHaveBeenCalled();
      expect(service.config.reminders).toContainEqual(newReminder);
    });

    it('handles service without focus guard', async () => {
      service.focusGuard = null;
      mockStateStore.getNextFireTime.mockResolvedValue(null);
      mockScheduler.getNextFireTime.mockReturnValue(new Date(Date.now() + 60000));

      const newReminder = {
        id: 'stretch-2',
        title: 'Stretch 2',
        cron: '0 14 * * *',
        blockWhenFocused: ['game'],
      };

      await expect(service.addReminder(newReminder)).resolves.not.toThrow();
    });
  });

  describe('updateReminder', () => {
    it('does nothing when reminder id not found', async () => {
      await expect(service.updateReminder('unknown', { title: 'Unknown' })).resolves.not.toThrow();
      expect(mockScheduler.getNextFireTime).not.toHaveBeenCalled();
    });

    it('clears old timers, updates config, and reschedules reminder', async () => {
      mockStateStore.getNextFireTime.mockResolvedValue(null);
      mockScheduler.getNextFireTime.mockReturnValue(new Date(Date.now() + 60000));

      await service.start();

      const updated = {
        id: 'water',
        title: 'Drink Cold Water',
        cron: '0 * * * *',
        blockWhenFocused: ['game'],
      };

      await service.updateReminder('water', updated);

      expect(service.config.reminders[0].title).toBe('Drink Cold Water');
      expect(mockFocusGuard.start).toHaveBeenCalled();
      expect(mockStateStore.setNextFireTime).toHaveBeenCalledWith('water', expect.any(String));
    });

    it('updates reminder when active timer is not running and blockWhenFocused is empty', async () => {
      mockStateStore.getNextFireTime.mockResolvedValue('2020-01-01T00:00:00Z');
      mockScheduler.getNextFireTime.mockReturnValue(new Date(Date.now() + 60000));
      mockAudioPlayer.pickRandom.mockReturnValue(null);

      const updated = {
        id: 'water',
        title: 'Drink Water Updated',
        cron: '0 * * * *',
      };

      await service.updateReminder('water', updated);
      expect(service.config.reminders[0].title).toBe('Drink Water Updated');
    });
  });

  describe('deleteReminder', () => {
    it('does nothing when reminder id not found', async () => {
      await expect(service.deleteReminder('unknown')).resolves.not.toThrow();
      expect(mockStateStore.clearNextFireTime).not.toHaveBeenCalled();
    });

    it('deletes reminder when active timer is not running', async () => {
      await service.deleteReminder('water');
      expect(service.config.reminders.find((r) => r.id === 'water')).toBeUndefined();
    });

    it('clears timers, removes from all collections, and clears state', async () => {
      mockStateStore.getNextFireTime.mockImplementation(async (id) =>
        id === 'water' ? '2020-01-01T00:00:00Z' : null
      );
      mockScheduler.getNextFireTime.mockReturnValue(new Date(Date.now() + 60000));
      mockAudioPlayer.pickRandom.mockReturnValue(null);

      await service.start();

      expect(service.shownReminders.has('water')).toBe(true);

      service.queue = [{ id: 'water' }, { id: 'break' }];

      await service.deleteReminder('water');

      expect(service.queue).toEqual([{ id: 'break' }]);
      expect(service.shownReminders.has('water')).toBe(false);
      expect(service.config.reminders.find((r) => r.id === 'water')).toBeUndefined();
      expect(mockReminderWindow.removeReminder).toHaveBeenCalledWith('water');
      expect(mockReminderWindow.hide).toHaveBeenCalled();
      expect(mockStateStore.clearNextFireTime).toHaveBeenCalledWith('water');
    });

    it('does not hide window on delete if other reminders are still shown', async () => {
      mockStateStore.getNextFireTime.mockResolvedValue('2020-01-01T00:00:00Z');
      mockScheduler.getNextFireTime.mockReturnValue(new Date(Date.now() + 60000));
      mockAudioPlayer.pickRandom.mockReturnValue(null);

      await service.start();

      expect(service.shownReminders.size).toBe(2);

      await service.deleteReminder('water');

      expect(mockReminderWindow.hide).not.toHaveBeenCalled();
    });
  });

  describe('updateSettings', () => {
    it('updates config, audioPlayer, reminderWindow, starts focusGuard and releases deferred reminders @spec:AC-006', async () => {
      mockAudioPlayer.setFfplayPath = jest.fn();
      mockReminderWindow.updateConfig = jest.fn();
      mockFocusGuard.stop = jest.fn();

      // Make 'water' defer while blocked
      service.config.blockWhenFocused = ['dota2'];
      service.config.reminders = [{ id: 'water', title: 'Drink Water', cron: '*/40 * * * *' }];
      mockFocusGuard.isBlocked.mockReturnValueOnce(true).mockReturnValue(false);
      mockStateStore.getNextFireTime.mockResolvedValue(null);
      mockScheduler.getNextFireTime.mockReturnValue(new Date(Date.now() + 60000));
      mockAudioPlayer.pickRandom.mockReturnValue(null);

      await service.start();
      await jest.advanceTimersByTimeAsync(60000);
      expect(service.deferredReminders.has('water')).toBe(true);

      const newSettings = {
        ffplayPath: 'C:\\ffmpeg\\ffplay.exe',
        autoSnoozeTimeout: 30000,
        snoozeInterval: 120000,
        blockWhenFocused: ['eldenring'],
        window: { width: 400, height: 260, defaultColor: '#223344' },
      };

      service.updateSettings(newSettings);

      expect(service.config.ffplayPath).toBe('C:\\ffmpeg\\ffplay.exe');
      expect(service.config.autoSnoozeTimeout).toBe(30000);
      expect(service.config.snoozeInterval).toBe(120000);
      expect(service.config.blockWhenFocused).toEqual(['eldenring']);
      expect(service.config.window).toEqual({ width: 400, height: 260, defaultColor: '#223344' });
      expect(mockAudioPlayer.setFfplayPath).toHaveBeenCalledWith('C:\\ffmpeg\\ffplay.exe');
      expect(mockReminderWindow.updateConfig).toHaveBeenCalledWith(service.config);
      expect(mockFocusGuard.start).toHaveBeenCalled();
      expect(mockFocusGuard.stop).not.toHaveBeenCalled();
      expect(service.deferredReminders.has('water')).toBe(false);
      expect(service.shownReminders.has('water')).toBe(true);
    });

    it('stops focusGuard when no reminder has blockWhenFocused and releases deferred reminders @spec:AC-006', async () => {
      mockFocusGuard.stop = jest.fn();
      service.deferredReminders.set('water', service.config.reminders[0]);
      mockFocusGuard.isBlocked.mockReturnValue(false);

      service.updateSettings({
        ffplayPath: '',
        autoSnoozeTimeout: 60000,
        snoozeInterval: 300000,
        blockWhenFocused: [],
        window: { width: 320, height: 220, defaultColor: '#1a1a2e' },
      });

      expect(mockFocusGuard.stop).toHaveBeenCalled();
      expect(service.deferredReminders.has('water')).toBe(false);
    });

    it('handles missing optional hooks and null dependencies gracefully @spec:AC-006', () => {
      // Case 1: focusGuard without stop() and default mocks without setFfplayPath/updateConfig
      service.updateSettings({
        ffplayPath: '',
        autoSnoozeTimeout: 60000,
        snoozeInterval: 300000,
        blockWhenFocused: [],
        window: { width: 320, height: 220, defaultColor: '#1a1a2e' },
      });

      // Case 2: audioPlayer, reminderWindow, and focusGuard all null
      service.audioPlayer = null;
      service.reminderWindow = null;
      service.focusGuard = null;

      expect(() =>
        service.updateSettings({
          ffplayPath: 'C:\\ffplay.exe',
          autoSnoozeTimeout: 10000,
          snoozeInterval: 20000,
          blockWhenFocused: ['game'],
          window: { width: 320, height: 220, defaultColor: '#1a1a2e' },
        })
      ).not.toThrow();
    });
  });

  describe('one-shot reminders and default sounds', () => {
    it('plays default sound for one-shots and respects useDefaultSound=false @spec:AC-010', async () => {
      mockStateStore.getNextFireTime.mockResolvedValue(null);
      mockAudioPlayer.pickRandom.mockReturnValue('/sounds/default-alert-1.mp3');

      const fireAt = new Date(Date.now() + 10000).toISOString();
      await service.addReminder({
        id: 'oneshot-sound-on',
        title: 'Sound On',
        oneShot: true,
        fireAt,
      });

      await jest.advanceTimersByTimeAsync(10000);
      expect(mockAudioPlayer.pickRandom).toHaveBeenCalledWith('default', 'alert');
      expect(mockAudioPlayer.play).toHaveBeenCalledWith('/sounds/default-alert-1.mp3');

      mockAudioPlayer.pickRandom.mockClear();
      mockAudioPlayer.play.mockClear();

      await service.addReminder({
        id: 'oneshot-silent',
        title: 'Silent',
        oneShot: true,
        fireAt: new Date(Date.now() + 5000).toISOString(),
        useDefaultSound: false,
      });

      await jest.advanceTimersByTimeAsync(5000);
      expect(mockAudioPlayer.pickRandom).not.toHaveBeenCalled();
      expect(mockAudioPlayer.play).not.toHaveBeenCalled();

      // Recurring reminder with useDefaultSound: false passes fallbackToDefault: false
      service.config.reminders.push({
        id: 'water-silent',
        title: 'Water Silent',
        cron: '0 * * * *',
        useDefaultSound: false,
      });
      mockAudioPlayer.pickRandom.mockReturnValue(null);
      service.resolveReminder('water-silent', 'done');
      expect(mockAudioPlayer.pickRandom).toHaveBeenCalledWith('water-silent', 'done', {
        fallbackToDefault: false,
      });
    });

    it('schedules one-shot via fireAt without calling cron scheduler and handles snooze without cron reschedule @spec:AC-011', async () => {
      mockStateStore.getNextFireTime.mockResolvedValue(null);
      mockAudioPlayer.pickRandom.mockReturnValue('/sounds/default-snooze-1.mp3');

      const fireAt = new Date(Date.now() + 15000).toISOString();
      await service.addReminder({
        id: 'oneshot-oven',
        title: 'Turn off oven',
        oneShot: true,
        fireAt,
        snoozeInterval: 30000,
        autoSnoozeTimeout: 0,
      });

      expect(mockScheduler.getNextFireTime).not.toHaveBeenCalled();
      expect(service.activeReminders.has('timeout_oneshot-oven')).toBe(true);

      await jest.advanceTimersByTimeAsync(15000);
      expect(mockReminderWindow.showReminder).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'oneshot-oven' }),
        expect.any(Number)
      );
      expect(service.activeReminders.has('timeout_oneshot-oven')).toBe(false);

      // Snooze schedules another timeout without calling scheduler.getInterval
      service.resolveReminder('oneshot-oven', 'snooze');
      expect(service.activeReminders.has('timeout_oneshot-oven')).toBe(true);

      await jest.advanceTimersByTimeAsync(30000);
      expect(mockScheduler.getInterval).not.toHaveBeenCalled();
      expect(mockReminderWindow.showReminder).toHaveBeenCalledTimes(2);
    });

    it('fires immediately when one-shot fireAt or restored state time is already in the past @spec:AC-011', async () => {
      mockAudioPlayer.pickRandom.mockReturnValue(null);

      // Case 1: Restored from stateStore with past timestamp
      service.config.reminders = [
        {
          id: 'oneshot-past-state',
          title: 'Past State',
          oneShot: true,
          fireAt: new Date(Date.now() + 60000).toISOString(),
        },
      ];
      mockStateStore.getNextFireTime.mockResolvedValue('2020-01-01T00:00:00');
      await service.start();
      expect(mockReminderWindow.showReminder).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'oneshot-past-state' }),
        expect.any(Number)
      );
      expect(mockScheduler.getNextFireTime).not.toHaveBeenCalled();

      // Case 2: No stateStore entry, fireAt <= now
      mockStateStore.getNextFireTime.mockResolvedValue(null);
      await service.addReminder({
        id: 'oneshot-past-fireat',
        title: 'Past FireAt',
        oneShot: true,
        fireAt: new Date(Date.now() - 5000).toISOString(),
      });
      expect(mockReminderWindow.showReminder).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'oneshot-past-fireat' }),
        expect.any(Number)
      );
    });

    it('deletes only the resolved one-shot on done and triggers onOneShotDone while preserving other one-shots @spec:AC-012', async () => {
      mockStateStore.getNextFireTime.mockResolvedValue(null);
      mockAudioPlayer.pickRandom.mockReturnValue('/sounds/default-done-1.mp3');

      const onDismiss = jest.fn();
      const onOneShotDone = jest.fn();
      service.onDismiss = onDismiss;
      service.onOneShotDone = onOneShotDone;

      await service.addReminder({
        id: 'oneshot-1',
        title: 'Oven',
        oneShot: true,
        fireAt: new Date(Date.now() + 10000).toISOString(),
      });
      await service.addReminder({
        id: 'oneshot-2',
        title: 'Laundry',
        oneShot: true,
        fireAt: new Date(Date.now() + 20000).toISOString(),
      });

      service.queue.push({ id: 'oneshot-1', title: 'Oven', oneShot: true });
      service.resolveReminder('oneshot-1', 'done');

      expect(service.activeReminders.has('timeout_oneshot-1')).toBe(false);
      expect(service.activeReminders.has('timeout_oneshot-2')).toBe(true);
      expect(service.queue.some((r) => r.id === 'oneshot-1')).toBe(false);
      expect(service.config.reminders.find((r) => r.id === 'oneshot-1')).toBeUndefined();
      expect(service.config.reminders.find((r) => r.id === 'oneshot-2')).toBeDefined();
      expect(mockStateStore.clearNextFireTime).toHaveBeenCalledWith('oneshot-1');
      expect(onOneShotDone).toHaveBeenCalledWith('oneshot-1');
      expect(onDismiss).toHaveBeenCalled();

      // Works without onDismiss or onOneShotDone set
      service.onDismiss = null;
      service.onOneShotDone = null;
      expect(() => service.resolveReminder('oneshot-2', 'done')).not.toThrow();
      expect(service.config.reminders.find((r) => r.id === 'oneshot-2')).toBeUndefined();
    });

    it('reschedules one-shot using new fireAt on updateReminder instead of stale stateStore entry @spec:AC-011', async () => {
      mockStateStore.getNextFireTime.mockResolvedValue(new Date(Date.now() + 5000).toISOString());
      mockAudioPlayer.pickRandom.mockReturnValue(null);

      await service.addReminder({
        id: 'oneshot-edit',
        title: 'Oven',
        oneShot: true,
        fireAt: new Date(Date.now() + 5000).toISOString(),
      });

      const updatedFireAt = new Date(Date.now() + 60000).toISOString();
      await service.updateReminder('oneshot-edit', {
        id: 'oneshot-edit',
        title: 'Oven Updated',
        oneShot: true,
        fireAt: updatedFireAt,
      });

      await jest.advanceTimersByTimeAsync(10000);
      expect(mockReminderWindow.showReminder).not.toHaveBeenCalled();

      await jest.advanceTimersByTimeAsync(50000);
      expect(mockReminderWindow.showReminder).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'oneshot-edit', title: 'Oven Updated' }),
        expect.any(Number)
      );
    });
  });
});
