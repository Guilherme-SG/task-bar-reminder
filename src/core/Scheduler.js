const { CronExpressionParser } = require('cron-parser');

class Scheduler {
  getNextFireTime(cronExpression, timezone) {
    const options = timezone ? { timezone } : undefined;
    const interval = CronExpressionParser.parse(cronExpression, options);
    return interval.next().toDate();
  }

  getInterval(cronExpression, timezone) {
    const options = timezone ? { timezone } : undefined;
    const interval = CronExpressionParser.parse(cronExpression, options);
    const t1 = interval.next().toDate();
    const t2 = interval.next().toDate();
    return t2.getTime() - t1.getTime();
  }
}

module.exports = Scheduler;
