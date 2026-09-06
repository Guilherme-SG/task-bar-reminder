const { CronExpressionParser } = require('cron-parser');

class Scheduler {
  getNextFireTime(cronExpression, timezone) {
    const options = timezone ? { timezone } : undefined;
    const interval = CronExpressionParser.parse(cronExpression, options);
    return interval.next().toDate();
  }
}

module.exports = Scheduler;
