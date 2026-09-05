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
    it('plays done sound on done action', async () => {
      mockAudioPlayer.pickRandom.mockReturnValue('/sounds/water-done-1.mp3');

      await service.resolveReminder('water', 'done');

      expect(mockAudioPlayer.pickRandom).toHaveBeenCalledWith('water', 'done');
      expect(mockAudioPlayer.play).toHaveBeenCalledWith('/sounds/water-done-1.mp3');
    });

    it('hides window on done', async () => {
      mockAudioPlayer.pickRandom.mockReturnValue(null);

      await service.resolveReminder('water', 'done');

      expect(mockReminderWindow.hide).toHaveBeenCalled();
    });

    it('skips done sound when pickRandom returns null', async () => {
      mockAudioPlayer.pickRandom.mockReturnValue(null);

      await service.resolveReminder('water', 'done');

      expect(mockAudioPlayer.play).not.toHaveBeenCalled();
    });

    it('plays snooze sound on snooze action', async () => {
      mockAudioPlayer.pickRandom.mockReturnValue('/sounds/water-snooze-1.mp3');

      await service.resolveReminder('water', 'snooze');

      expect(mockAudioPlayer.pickRandom).toHaveBeenCalledWith('water', 'snooze');
      expect(mockAudioPlayer.play).toHaveBeenCalledWith('/sounds/water-snooze-1.mp3');
    });

    it('skips snooze sound when pickRandom returns null', async () => {
      mockAudioPlayer.pickRandom.mockReturnValue(null);

      await service.resolveReminder('water', 'snooze');

      expect(mockAudioPlayer.play).not.toHaveBeenCalled();
    });

    it('schedules next timeout on snooze', async () => {
      mockAudioPlayer.pickRandom.mockReturnValue(null);

      await service.resolveReminder('water', 'snooze');

      expect(service.activeReminders.has('timeout_water')).toBe(true);
    });

    it('hides window on snooze', async () => {
      mockAudioPlayer.pickRandom.mockReturnValue(null);

      await service.resolveReminder('water', 'snooze');

      expect(mockReminderWindow.hide).toHaveBeenCalled();
    });

    it('does nothing for unknown reminder id', async () => {
      await service.resolveReminder('nonexistent', 'done');

      expect(mockAudioPlayer.pickRandom).not.toHaveBeenCalled();
    });

    it('does nothing for unknown action', async () => {
      await service.resolveReminder('water', 'unknown');

      expect(mockAudioPlayer.pickRandom).not.toHaveBeenCalled();
    });
  });

  describe('getActiveReminders', () => {
    it('returns id and title for all reminders', () => {
      const result = service.getActiveReminders();

      expect(result).toEqual([
        { id: 'water', title: 'Drink Water' },
        { id: 'break', title: 'Take Break' },
      ]);
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

      await service.resolveReminder('water', 'done');
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
      await service.resolveReminder('water', 'done');

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
    it('shows reminder after wake-up sound', async () => {
      mockStateStore.getNextFireTime.mockResolvedValue(null);
      mockScheduler.getNextFireTime.mockReturnValue(new Date(Date.now() + 60000));
      mockAudioPlayer.pickRandom.mockReturnValue('/sounds/water-wake-up-1.mp3');

      await service.start();

      await jest.advanceTimersByTimeAsync(60000);

      expect(mockReminderWindow.showReminder).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'water' }),
        expect.any(Number)
      );
    });

    it('skips wake-up sound when pickRandom returns null', async () => {
      mockStateStore.getNextFireTime.mockResolvedValue(null);
      mockScheduler.getNextFireTime.mockReturnValue(new Date(Date.now() + 60000));
      mockAudioPlayer.pickRandom.mockReturnValue(null);

      await service.start();

      await jest.advanceTimersByTimeAsync(60000);

      expect(mockReminderWindow.showReminder).toHaveBeenCalled();
      expect(mockAudioPlayer.play).not.toHaveBeenCalled();
    });
  });

  describe('scheduleNext', () => {
    it('clears existing timeout before setting new one', async () => {
      mockStateStore.getNextFireTime.mockResolvedValue(null);
      mockScheduler.getNextFireTime.mockReturnValue(new Date(Date.now() + 60000));

      await service.start();

      expect(service.activeReminders.has('timeout_water')).toBe(true);
    });

    it('replaces existing timeout when scheduling same reminder again', async () => {
      mockAudioPlayer.pickRandom.mockReturnValue(null);
      mockScheduler.getNextFireTime.mockReturnValue(new Date(Date.now() + 60000));

      await service.resolveReminder('water', 'snooze');
      const firstTimeout = service.activeReminders.get('timeout_water');

      await service.resolveReminder('water', 'snooze');
      const secondTimeout = service.activeReminders.get('timeout_water');

      expect(firstTimeout).not.toBe(secondTimeout);
    });
  });
});
