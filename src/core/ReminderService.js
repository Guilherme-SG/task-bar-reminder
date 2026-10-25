const { REMINDER_ACTIONS, TIMEOUT_KEY_PREFIX } = require('../utils/constants.js');

class ReminderService {
  constructor({ scheduler, reminderWindow, stateStore, audioPlayer, config, focusGuard }) {
    this.scheduler = scheduler;
    this.reminderWindow = reminderWindow;
    this.stateStore = stateStore;
    this.audioPlayer = audioPlayer;
    this.config = config;
    this.focusGuard = focusGuard;

    this.queue = [];
    this.activeReminders = new Map();
    this.shownReminders = new Set();
    this.deferredReminders = new Map();
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

  #getBlockApps(reminder) {
    return reminder.blockWhenFocused ?? this.config.blockWhenFocused ?? [];
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

    const offset = nextFireTime.getTimezoneOffset() * 60000;
    const local = new Date(nextFireTime.getTime() - offset);
    this.stateStore.setNextFireTime(reminder.id, local.toISOString().slice(0, 19));
    this.#scheduleTimeout(reminder, delay);
  }

  #scheduleNextFromNow(reminder) {
    const interval = this.scheduler.getInterval(reminder.cron);
    const nextFireTime = Date.now() + interval;

    const date = new Date(nextFireTime);
    const offset = date.getTimezoneOffset() * 60000;
    const local = new Date(date.getTime() - offset);
    this.stateStore.setNextFireTime(reminder.id, local.toISOString().slice(0, 19));
    this.#scheduleTimeout(reminder, interval);
  }

  #scheduleTimeout(reminder, delay, onFire) {
    const key = `${TIMEOUT_KEY_PREFIX}${reminder.id}`;

    if (this.activeReminders.has(key)) {
      clearTimeout(this.activeReminders.get(key));
    }

    const callback = onFire || (() => this.#scheduleNext(reminder));

    const timeout = setTimeout(() => {
      this.activeReminders.delete(key);
      this.#fire(reminder);
      callback();
    }, Math.max(0, delay));

    this.activeReminders.set(key, timeout);

    const nextFireTime = Date.now() + Math.max(0, delay);
    const date = new Date(nextFireTime);
    const offset = date.getTimezoneOffset() * 60000;
    const local = new Date(date.getTime() - offset);
    this.stateStore.setNextFireTime(reminder.id, local.toISOString().slice(0, 19));
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

      this.#playSound(reminder, 'alert');

      const blockApps = this.#getBlockApps(reminder);
      if (blockApps.length > 0 && this.focusGuard.isBlocked(blockApps)) {
        this.deferredReminders.set(reminder.id, reminder);
        if (this.onShow) this.onShow(this.getActiveReminders());
        continue;
      }

      this.#showReminder(reminder);
    }
  }

  #showReminder(reminder) {
    this.shownReminders.add(reminder.id);
    if (this.onShow) this.onShow(this.getActiveReminders());

    this.reminderWindow.showReminder(reminder, this.queue.length);
    this.#startAutoDismiss(reminder);
  }

  releaseDeferredReminders() {
    if (this.deferredReminders.size === 0) return;

    for (const [reminderId, reminder] of this.deferredReminders) {
      if (this.focusGuard.isBlocked(this.#getBlockApps(reminder))) continue;

      this.deferredReminders.delete(reminderId);
      this.#showReminder(reminder);
    }
  }

  resolveReminder(reminderId, action) {
    const reminder = this.config.reminders.find((r) => r.id === reminderId);
    if (!reminder) return;

    this.#cancelAutoDismiss(reminderId);
    this.shownReminders.delete(reminderId);
    this.deferredReminders.delete(reminderId);
    if (this.onDismiss) this.onDismiss(this.getActiveReminders());

    this.reminderWindow.removeReminder(reminderId);

    if (action === REMINDER_ACTIONS.DONE) {
      this.#playSound(reminder, 'done');
      this.reminderWindow.hide();
    } else if (action === REMINDER_ACTIONS.SNOOZE) {
      this.#playSound(reminder, 'snooze');
      this.reminderWindow.hide();
      this.#scheduleTimeout(reminder, this.#getSnoozeInterval(reminder), () => this.#scheduleNextFromNow(reminder));
    }
  }

  getActiveReminders() {
    return this.config.reminders
      .filter((r) => this.shownReminders.has(r.id) || this.deferredReminders.has(r.id))
      .map((r) => ({
        id: r.id,
        title: r.title,
        pending: this.deferredReminders.has(r.id) && !this.shownReminders.has(r.id),
      }));
  }
}

module.exports = ReminderService;
