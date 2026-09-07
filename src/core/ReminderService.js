const { REMINDER_ACTIONS, TIMEOUT_KEY_PREFIX } = require('../utils/constants.js');

class ReminderService {
  constructor({ scheduler, reminderWindow, stateStore, audioPlayer, config }) {
    this.scheduler = scheduler;
    this.reminderWindow = reminderWindow;
    this.stateStore = stateStore;
    this.audioPlayer = audioPlayer;
    this.config = config;

    this.queue = [];
    this.activeReminders = new Map();
    this.shownReminders = new Set();
    this.autoDismissTimers = new Map();
    this.onShow = null;
    this.onDismiss = null;
  }

  #getSnoozeInterval(reminder) {
    return reminder.snoozeInterval ?? this.config.snoozeInterval;
  }

  #getAutoSnoozeTimeout(reminder) {
    return reminder.autoSnoozeTimeout ?? this.config.autoSnoozeTimeout;
  }

  async start() {
    for (const reminder of this.config.reminders) {
      await this.#initReminder(reminder);
    }
  }

  async #initReminder(reminder) {
    const nextFireTime = await this.stateStore.getNextFireTime(reminder.id);

    if (nextFireTime) {
      const remaining = new Date(nextFireTime).getTime() - Date.now();

      if (remaining <= 0) {
        this.#fire(reminder);
        this.#scheduleNext(reminder);
        return;
      }

      this.#scheduleTimeout(reminder, remaining);
      return;
    }

    this.#scheduleNext(reminder);
  }

  #scheduleNext(reminder) {
    const nextFireTime = this.scheduler.getNextFireTime(reminder.cron);
    const delay = nextFireTime.getTime() - Date.now();

    this.stateStore.setNextFireTime(reminder.id, nextFireTime.toISOString());
    this.#scheduleTimeout(reminder, delay);
  }

  #scheduleTimeout(reminder, delay) {
    const key = `${TIMEOUT_KEY_PREFIX}${reminder.id}`;

    if (this.activeReminders.has(key)) {
      clearTimeout(this.activeReminders.get(key));
    }

    const timeout = setTimeout(() => {
      this.activeReminders.delete(key);
      this.#fire(reminder);
      this.#scheduleNext(reminder);
    }, Math.max(0, delay));

    this.activeReminders.set(key, timeout);
  }

  #startAutoDismiss(reminder) {
    this.#cancelAutoDismiss(reminder.id);

    const timeout = this.#getAutoSnoozeTimeout(reminder);
    if (!timeout) return;

    const timer = setTimeout(() => {
      this.autoDismissTimers.delete(reminder.id);
      this.resolveReminder(reminder.id, REMINDER_ACTIONS.SNOOZE);
    }, timeout);

    this.autoDismissTimers.set(reminder.id, timer);
  }

  #cancelAutoDismiss(reminderId) {
    if (this.autoDismissTimers.has(reminderId)) {
      clearTimeout(this.autoDismissTimers.get(reminderId));
      this.autoDismissTimers.delete(reminderId);
    }
  }

  #fire(reminder) {
    this.queue.push(reminder);
    this.#processQueue();
  }

  #playSound(reminder, soundType) {
    const sound = this.audioPlayer.pickRandom(reminder.id, soundType);
    if (sound) {
      this.audioPlayer.play(sound);
    }
  }

  #processQueue() {
    while (this.queue.length > 0) {
      const reminder = this.queue.shift();

      if (this.shownReminders.has(reminder.id)) {
        this.#scheduleTimeout(reminder, this.#getSnoozeInterval(reminder));
      }

      this.#playSound(reminder, 'alert');

      this.shownReminders.add(reminder.id);
      if (this.onShow) this.onShow(this.getShownReminders());

      this.reminderWindow.showReminder(reminder, this.queue.length);
      this.#startAutoDismiss(reminder);
    }
  }

  resolveReminder(reminderId, action) {
    const reminder = this.config.reminders.find((r) => r.id === reminderId);
    if (!reminder) return;

    this.#cancelAutoDismiss(reminderId);
    this.shownReminders.delete(reminderId);
    if (this.onDismiss) this.onDismiss(this.getShownReminders());

    this.reminderWindow.removeReminder(reminderId);

    if (action === REMINDER_ACTIONS.DONE) {
      this.#playSound(reminder, 'done');
      this.reminderWindow.hide();
    } else if (action === REMINDER_ACTIONS.SNOOZE) {
      this.#playSound(reminder, 'snooze');
      this.reminderWindow.hide();
      this.#scheduleTimeout(reminder, this.#getSnoozeInterval(reminder));
    }
  }

  getShownReminders() {
    return this.config.reminders
      .filter((r) => this.shownReminders.has(r.id))
      .map((r) => ({ id: r.id, title: r.title }));
  }
}

module.exports = ReminderService;
