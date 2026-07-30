const { calculateLeaveDays } = require('../../src/utils/leaveCalculations');

describe('leaveCalculations.calculateLeaveDays', () => {
  it('counts a single-day leave as 1 day', () => {
    expect(calculateLeaveDays(new Date('2026-08-03'), new Date('2026-08-03'))).toBe(1);
  });

  it('counts a multi-day range inclusively', () => {
    expect(calculateLeaveDays(new Date('2026-08-03'), new Date('2026-08-05'))).toBe(3);
  });

  it('handles ranges spanning a month boundary', () => {
    expect(calculateLeaveDays(new Date('2026-07-30'), new Date('2026-08-02'))).toBe(4);
  });

  it('ignores time-of-day components (only counts calendar days)', () => {
    const start = new Date('2026-08-03T22:00:00');
    const end = new Date('2026-08-04T01:00:00');
    expect(calculateLeaveDays(start, end)).toBe(2);
  });
});
