jest.mock('cron-parser', () => ({
  CronExpressionParser: {
    parse: jest.fn(),
  },
}));

const { CronExpressionParser } = require('cron-parser');
const Scheduler = require('../../src/core/Scheduler');

describe('Scheduler', () => {
  let scheduler;

  beforeEach(() => {
    jest.clearAllMocks();
    scheduler = new Scheduler();
  });

  describe('getNextFireTime', () => {
    it('returns a Date for a valid cron expression', () => {
      const mockDate = new Date('2026-09-05T16:00:00Z');
      CronExpressionParser.parse.mockReturnValue({
        next: jest.fn().mockReturnValue({
          toDate: jest.fn().mockReturnValue(mockDate),
        }),
      });

      const result = scheduler.getNextFireTime('0 * * * *');

      expect(result.getTime()).toBe(mockDate.getTime());
      expect(CronExpressionParser.parse).toHaveBeenCalledWith('0 * * * *', undefined);
    });

    it('passes timezone when provided', () => {
      const mockDate = new Date('2026-09-05T16:00:00Z');
      CronExpressionParser.parse.mockReturnValue({
        next: jest.fn().mockReturnValue({
          toDate: jest.fn().mockReturnValue(mockDate),
        }),
      });

      scheduler.getNextFireTime('0 * * * *', 'UTC');

      expect(CronExpressionParser.parse).toHaveBeenCalledWith('0 * * * *', { timezone: 'UTC' });
    });

    it('returns the earliest time across an array of expressions', () => {
      const early = new Date('2026-09-05T16:00:00Z');
      const late = new Date('2026-09-05T16:40:00Z');
      CronExpressionParser.parse.mockImplementation((expression) => ({
        next: jest.fn().mockReturnValue({
          toDate: jest.fn().mockReturnValue(expression === 'late' ? late : early),
        }),
      }));

      const result = scheduler.getNextFireTime(['early', 'late']);

      expect(result.getTime()).toBe(early.getTime());
      expect(CronExpressionParser.parse).toHaveBeenCalledTimes(2);
      expect(CronExpressionParser.parse).toHaveBeenCalledWith('early', undefined);
      expect(CronExpressionParser.parse).toHaveBeenCalledWith('late', undefined);
    });

    it('passes timezone to every expression in an array', () => {
      CronExpressionParser.parse.mockReturnValue({
        next: jest.fn().mockReturnValue({
          toDate: jest.fn().mockReturnValue(new Date('2026-09-05T16:00:00Z')),
        }),
      });

      scheduler.getNextFireTime(['0 * * * *', '30 * * * *'], 'UTC');

      expect(CronExpressionParser.parse).toHaveBeenCalledWith('0 * * * *', { timezone: 'UTC' });
      expect(CronExpressionParser.parse).toHaveBeenCalledWith('30 * * * *', { timezone: 'UTC' });
    });
  });

  describe('getInterval', () => {
    it('returns ms between consecutive cron fires', () => {
      const t1 = new Date('2026-09-05T16:00:00Z');
      const t2 = new Date('2026-09-05T16:40:00Z');
      const mockNext = jest.fn()
        .mockReturnValueOnce({ toDate: jest.fn().mockReturnValue(t1) })
        .mockReturnValueOnce({ toDate: jest.fn().mockReturnValue(t2) });
      CronExpressionParser.parse.mockReturnValue({ next: mockNext });

      const result = scheduler.getInterval('*/40 * * * *');

      expect(result).toBe(2400000);
      expect(CronExpressionParser.parse).toHaveBeenCalledWith('*/40 * * * *', undefined);
    });

    it('passes timezone when provided', () => {
      const t1 = new Date('2026-09-05T16:00:00Z');
      const t2 = new Date('2026-09-05T17:00:00Z');
      const mockNext = jest.fn()
        .mockReturnValueOnce({ toDate: jest.fn().mockReturnValue(t1) })
        .mockReturnValueOnce({ toDate: jest.fn().mockReturnValue(t2) });
      CronExpressionParser.parse.mockReturnValue({ next: mockNext });

      scheduler.getInterval('0 * * * *', 'UTC');

      expect(CronExpressionParser.parse).toHaveBeenCalledWith('0 * * * *', { timezone: 'UTC' });
    });

    it('returns the gap between the next two fires across grouped expressions', () => {
      const evenBefore = new Date('2026-09-05T18:00:00Z');
      const evenAfter = new Date('2026-09-05T18:00:00Z');
      const oddBefore = new Date('2026-09-05T17:20:00Z');
      const oddAfter = new Date('2026-09-05T19:20:00Z');

      CronExpressionParser.parse.mockImplementation((expression, options) => {
        const afterFirst = Boolean(options && options.currentDate);
        let nextTime;
        if (expression === 'even') {
          nextTime = afterFirst ? evenAfter : evenBefore;
        } else {
          nextTime = afterFirst ? oddAfter : oddBefore;
        }
        return {
          next: jest.fn().mockReturnValue({ toDate: jest.fn().mockReturnValue(nextTime) }),
        };
      });

      const result = scheduler.getInterval(['even', 'odd']);

      expect(result).toBe(40 * 60 * 1000);
    });
  });
});
