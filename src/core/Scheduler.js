const cron = require('node-cron');
const { CronExpressionParser } = require('cron-parser');

class Scheduler {
  constructor() {
    this.tasks = new Map();
  }

  add(id, cronExpression, callback, timezone) {
    this.remove(id);

    const options = timezone ? { timezone } : undefined;
    const task = cron.schedule(cronExpression, callback, options);
    this.tasks.set(id, task);
  }

  remove(id) {
    const task = this.tasks.get(id);
    if (task) {
      task.stop();
      this.tasks.delete(id);
    }
  }

  removeAll() {
    for (const [id] of this.tasks) {
      this.remove(id);
    }
  }

  getNextFireTime(cronExpression, timezone) {
    const options = timezone ? { timezone } : undefined;
    const interval = CronExpressionParser.parse(cronExpression, options);
    return interval.next().toDate();
  }

  has(id) {
    return this.tasks.has(id);
  }
}

module.exports = Scheduler;
