jest.mock('node-cron', () => ({
  schedule: jest.fn(),
}));

jest.mock('cron-parser', () => ({
  CronExpressionParser: {
    parse: jest.fn(),
  },
}));

const cron = require('node-cron');
const { CronExpressionParser } = require('cron-parser');
const Scheduler = require('../../src/core/Scheduler');

describe('Scheduler', () => {
  let scheduler;

  beforeEach(() => {
    jest.clearAllMocks();
    scheduler = new Scheduler();
  });

  describe('add', () => {
    it('creates a cron task and stores it', () => {
      const mockTask = { stop: jest.fn() };
      cron.schedule.mockReturnValue(mockTask);

      scheduler.add('job1', '* * * * *', jest.fn());

      expect(cron.schedule).toHaveBeenCalledWith('* * * * *', expect.any(Function), undefined);
      expect(scheduler.has('job1')).toBe(true);
    });

    it('passes timezone option when provided', () => {
      const mockTask = { stop: jest.fn() };
      cron.schedule.mockReturnValue(mockTask);

      scheduler.add('job1', '* * * * *', jest.fn(), 'America/Sao_Paulo');

      expect(cron.schedule).toHaveBeenCalledWith('* * * * *', expect.any(Function), { timezone: 'America/Sao_Paulo' });
    });

    it('replaces existing task with same id', () => {
      const mockTask1 = { stop: jest.fn() };
      const mockTask2 = { stop: jest.fn() };
      cron.schedule
        .mockReturnValueOnce(mockTask1)
        .mockReturnValueOnce(mockTask2);

      scheduler.add('job1', '* * * * *', jest.fn());
      scheduler.add('job1', '0 * * * *', jest.fn());

      expect(mockTask1.stop).toHaveBeenCalled();
      expect(scheduler.has('job1')).toBe(true);
    });
  });

  describe('remove', () => {
    it('stops and removes an existing task', () => {
      const mockTask = { stop: jest.fn() };
      cron.schedule.mockReturnValue(mockTask);

      scheduler.add('job1', '* * * * *', jest.fn());
      scheduler.remove('job1');

      expect(mockTask.stop).toHaveBeenCalled();
      expect(scheduler.has('job1')).toBe(false);
    });

    it('does nothing for nonexistent id', () => {
      expect(() => scheduler.remove('nonexistent')).not.toThrow();
    });
  });

  describe('removeAll', () => {
    it('stops all tasks', () => {
      const mockTask1 = { stop: jest.fn() };
      const mockTask2 = { stop: jest.fn() };
      cron.schedule
        .mockReturnValueOnce(mockTask1)
        .mockReturnValueOnce(mockTask2);

      scheduler.add('job1', '* * * * *', jest.fn());
      scheduler.add('job2', '0 * * * *', jest.fn());
      scheduler.removeAll();

      expect(mockTask1.stop).toHaveBeenCalled();
      expect(mockTask2.stop).toHaveBeenCalled();
      expect(scheduler.has('job1')).toBe(false);
      expect(scheduler.has('job2')).toBe(false);
    });

    it('does nothing on empty map', () => {
      expect(() => scheduler.removeAll()).not.toThrow();
    });
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

  describe('has', () => {
    it('returns false for nonexistent id', () => {
      expect(scheduler.has('nonexistent')).toBe(false);
    });

    it('returns true for existing id', () => {
      const mockTask = { stop: jest.fn() };
      cron.schedule.mockReturnValue(mockTask);

      scheduler.add('job1', '* * * * *', jest.fn());

      expect(scheduler.has('job1')).toBe(true);
    });
  });
});
