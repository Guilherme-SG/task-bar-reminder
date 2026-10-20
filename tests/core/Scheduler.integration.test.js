const Scheduler = require('../../src/core/Scheduler');

describe('Scheduler with grouped cron rules', () => {
  it('produces a true 40-minute cadence across two rules', () => {
    const scheduler = new Scheduler();
    const rules = ['0 0,40 0-23/2 * * *', '0 20 1-23/2 * * *'];

    let from = new Date('2026-10-19T10:40:01');
    const fireTimes = [];

    for (let i = 0; i < 5; i += 1) {
      const next = scheduler.getNextFireTime(rules, undefined, from);
      fireTimes.push(next);
      from = new Date(next.getTime() + 1000);
    }

    const labels = fireTimes.map(
      (date) => `${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`
    );
    expect(labels).toEqual(['11:20', '12:00', '12:40', '13:20', '14:00']);

    const gapsInMinutes = fireTimes
      .slice(1)
      .map((date, index) => (date.getTime() - fireTimes[index].getTime()) / 60000);
    expect(gapsInMinutes).toEqual([40, 40, 40, 40]);
  });
});
