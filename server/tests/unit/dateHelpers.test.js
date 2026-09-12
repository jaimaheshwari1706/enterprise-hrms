const { startOfDay, endOfDay, addDays, toDateString, monthString, startOfYear } = require('../../src/utils/dateHelpers');

describe('dateHelpers (timezone-aware day keys)', () => {
  it('keys a check-in at 02:00 IST to the IST calendar day, not the UTC one', () => {
    // 2026-09-14T20:30:00Z is 2026-09-15 02:00 in Asia/Kolkata.
    const instant = new Date('2026-09-14T20:30:00Z');
    expect(startOfDay(instant, 'Asia/Kolkata').toISOString()).toBe('2026-09-15T00:00:00.000Z');
    // The same instant seen from UTC is still the 14th.
    expect(startOfDay(instant, 'UTC').toISOString()).toBe('2026-09-14T00:00:00.000Z');
  });

  it('produces the same key for a date-only string regardless of timezone', () => {
    expect(startOfDay('2026-09-15T00:00:00Z', 'UTC').toISOString()).toBe('2026-09-15T00:00:00.000Z');
  });

  it('endOfDay is the last millisecond of the same key', () => {
    const start = startOfDay('2026-09-15T00:00:00Z', 'UTC');
    const end = endOfDay('2026-09-15T00:00:00Z', 'UTC');
    expect(end.getTime() - start.getTime()).toBe(24 * 60 * 60 * 1000 - 1);
  });

  it('addDays steps whole days across a month boundary', () => {
    const key = startOfDay('2026-01-31T00:00:00Z', 'UTC');
    expect(toDateString(addDays(key, 1), 'UTC')).toBe('2026-02-01');
    expect(toDateString(addDays(key, -31), 'UTC')).toBe('2025-12-31');
  });

  it('monthString handles year rollover when offsetting', () => {
    const jan = new Date('2026-01-15T12:00:00Z');
    expect(monthString(jan, 0, 'UTC')).toBe('2026-01');
    expect(monthString(jan, 1, 'UTC')).toBe('2025-12');
    expect(monthString(jan, 5, 'UTC')).toBe('2025-08');
  });

  it('startOfYear is Jan 1 of the business year', () => {
    expect(startOfYear(new Date('2026-06-01T00:00:00Z'), 'UTC').toISOString()).toBe('2026-01-01T00:00:00.000Z');
  });

  it('returns an Invalid Date for garbage rather than throwing', () => {
    expect(Number.isNaN(startOfDay('not-a-date').getTime())).toBe(true);
  });
});
