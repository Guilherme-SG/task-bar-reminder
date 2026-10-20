const { CronExpressionParser } = require('cron-parser');

class Scheduler {
  getNextFireTime(cronExpression, timezone, currentDate) {
    const options = {};
    if (timezone) options.timezone = timezone;
    if (currentDate) options.currentDate = currentDate;
    const parseOptions = Object.keys(options).length > 0 ? options : undefined;

    const expressions = Array.isArray(cronExpression) ? cronExpression : [cronExpression];
    const nextFireTimes = expressions.map((expression) =>
      CronExpressionParser.parse(expression, parseOptions).next().toDate().getTime()
    );

    return new Date(Math.min(...nextFireTimes));
  }

  getInterval(cronExpression, timezone) {
    const t1 = this.getNextFireTime(cronExpression, timezone);
    const t2 = this.getNextFireTime(cronExpression, timezone, new Date(t1.getTime() + 1));
    return t2.getTime() - t1.getTime();
  }
}

module.exports = Scheduler;
