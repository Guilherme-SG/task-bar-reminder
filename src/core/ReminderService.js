const REMINDER_ACTIONS = {
  DONE: 'done',
  SNOOZE: 'snooze',
};

class ReminderService {
  constructor({ scheduler, reminderWindow, stateStore, audioPlayer, config }) {
    this.scheduler = scheduler;
    this.reminderWindow = reminderWindow;
    this.stateStore = stateStore;
    this.audioPlayer = audioPlayer;
    this.config = config;

    this.queue = [];
    this.processing = false;
    this.activeReminders = new Map();
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
    const key = `timeout_${reminder.id}`;

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

  #fire(reminder) {
    this.queue.push(reminder);
    this.#processQueue();
  }

  async #processQueue() {
    if (this.processing || this.queue.length === 0) return;

    this.processing = true;
    const reminder = this.queue.shift();

    const wakeUpSound = this.audioPlayer.pickRandom(reminder.id, 'wake-up');
    if (wakeUpSound) {
      await this.audioPlayer.play(wakeUpSound);
    }

    this.reminderWindow.showReminder(reminder, this.queue.length);

    this.processing = false;
    this.#processQueue();
  }

  async resolveReminder(reminderId, action) {
    const reminder = this.config.reminders.find((r) => r.id === reminderId);
    if (!reminder) return;

    if (action === REMINDER_ACTIONS.DONE) {
      const doneSound = this.audioPlayer.pickRandom(reminder.id, 'done');
      if (doneSound) {
        await this.audioPlayer.play(doneSound);
      }
    } else if (action === REMINDER_ACTIONS.SNOOZE) {
      const snoozeSound = this.audioPlayer.pickRandom(reminder.id, 'snooze');
      if (snoozeSound) {
        await this.audioPlayer.play(snoozeSound);
      }

      this.#scheduleTimeout(reminder, this.config.snoozeInterval);
    }
  }

  getActiveReminders() {
    return this.config.reminders.map((r) => ({
      id: r.id,
      title: r.title,
    }));
  }
}

module.exports = ReminderService;
