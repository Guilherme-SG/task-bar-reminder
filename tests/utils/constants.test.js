const { REMINDER_ACTIONS, TIMEOUT_KEY_PREFIX, SECONDS_TO_MS } = require('../../src/utils/constants');

describe('constants', () => {
  describe('REMINDER_ACTIONS', () => {
    it('has DONE action', () => {
      expect(REMINDER_ACTIONS.DONE).toBe('done');
    });

    it('has SNOOZE action', () => {
      expect(REMINDER_ACTIONS.SNOOZE).toBe('snooze');
    });
  });

  describe('TIMEOUT_KEY_PREFIX', () => {
    it('is correct prefix', () => {
      expect(TIMEOUT_KEY_PREFIX).toBe('timeout_');
    });
  });

  describe('SECONDS_TO_MS', () => {
    it('is 1000', () => {
      expect(SECONDS_TO_MS).toBe(1000);
    });
  });
});
