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

      expect(result).toBe(mockDate);
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
  });
});
