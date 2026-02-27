import { isTradeTime, isWorkday, formatDate, sleep, configDayToJsDay } from '../time.util';

describe('time.util', () => {
  describe('isTradeTime', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should return false on Saturday', () => {
      jest.setSystemTime(new Date('2026-02-28T10:00:00')); // Saturday
      expect(isTradeTime()).toBe(false);
    });

    it('should return false on Sunday', () => {
      jest.setSystemTime(new Date('2026-03-01T10:00:00')); // Sunday
      expect(isTradeTime()).toBe(false);
    });

    it('should return true on weekday before 15:00', () => {
      jest.setSystemTime(new Date('2026-02-25T14:30:00')); // Wednesday 14:30
      expect(isTradeTime()).toBe(true);
    });

    it('should return true at exactly 15:00', () => {
      jest.setSystemTime(new Date('2026-02-25T15:00:00')); // Wednesday 15:00
      expect(isTradeTime()).toBe(true);
    });

    it('should return false after 15:00', () => {
      jest.setSystemTime(new Date('2026-02-25T15:01:00')); // Wednesday 15:01
      expect(isTradeTime()).toBe(false);
    });

    it('should return true on Monday morning', () => {
      jest.setSystemTime(new Date('2026-02-23T09:30:00')); // Monday 09:30
      expect(isTradeTime()).toBe(true);
    });

    it('should return true on Friday before 15:00', () => {
      jest.setSystemTime(new Date('2026-02-27T14:59:00')); // Friday 14:59
      expect(isTradeTime()).toBe(true);
    });
  });

  describe('isWorkday', () => {
    it('should return true for Monday', () => {
      const monday = new Date('2026-02-23T10:00:00');
      expect(isWorkday(monday)).toBe(true);
    });

    it('should return true for Friday', () => {
      const friday = new Date('2026-02-27T10:00:00');
      expect(isWorkday(friday)).toBe(true);
    });

    it('should return false for Saturday', () => {
      const saturday = new Date('2026-02-28T10:00:00');
      expect(isWorkday(saturday)).toBe(false);
    });

    it('should return false for Sunday', () => {
      const sunday = new Date('2026-03-01T10:00:00');
      expect(isWorkday(sunday)).toBe(false);
    });

    it('should use current date when no parameter provided', () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-02-25T10:00:00')); // Wednesday
      expect(isWorkday()).toBe(true);
      jest.useRealTimers();
    });
  });

  describe('formatDate', () => {
    it('should format date correctly', () => {
      const date = new Date('2026-02-25T10:00:00');
      expect(formatDate(date)).toBe('2026-02-25');
    });

    it('should pad single digit month', () => {
      const date = new Date('2026-01-05T10:00:00');
      expect(formatDate(date)).toBe('2026-01-05');
    });

    it('should pad single digit day', () => {
      const date = new Date('2026-12-01T10:00:00');
      expect(formatDate(date)).toBe('2026-12-01');
    });

    it('should handle year end date', () => {
      const date = new Date('2026-12-31T23:59:59');
      expect(formatDate(date)).toBe('2026-12-31');
    });
  });

  describe('sleep', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should resolve after specified milliseconds', async () => {
      const promise = sleep(1000);
      jest.advanceTimersByTime(1000);
      await expect(promise).resolves.toBeUndefined();
    });

    it('should not resolve before specified time', async () => {
      const promise = sleep(1000);
      jest.advanceTimersByTime(500);

      let resolved = false;
      promise.then(() => {
        resolved = true;
      });

      await Promise.resolve();
      expect(resolved).toBe(false);
    });
  });

  describe('configDayToJsDay', () => {
    it('should convert Monday (1) to JS day 1', () => {
      expect(configDayToJsDay(1)).toBe(1);
    });

    it('should convert Tuesday (2) to JS day 2', () => {
      expect(configDayToJsDay(2)).toBe(2);
    });

    it('should convert Friday (5) to JS day 5', () => {
      expect(configDayToJsDay(5)).toBe(5);
    });

    it('should convert Saturday (6) to JS day 6', () => {
      expect(configDayToJsDay(6)).toBe(6);
    });

    it('should convert Sunday (7) to JS day 0', () => {
      expect(configDayToJsDay(7)).toBe(0);
    });
  });
});
