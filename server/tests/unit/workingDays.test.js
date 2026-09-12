const {
  buildCalendar,
  isWorkingDay,
  isWeekend,
  isHoliday,
  countWorkingDays,
  listWorkingDays,
  classifyRange,
  countCalendarDays,
  monthRange,
} = require('../../src/utils/workingDays');
const { calculateLeaveDays, summarizeLeaveRange } = require('../../src/utils/leaveCalculations');

const d = (iso) => new Date(`${iso}T00:00:00Z`);

// September 2026: the 1st is a Tuesday; 5/6, 12/13, 19/20, 26/27 are weekends.
const monFri = buildCalendar({
  workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
  holidays: [{ date: d('2026-09-14'), name: 'Founders Day' }],
});

describe('workingDays.buildCalendar', () => {
  it('falls back to Monday–Friday when no working days are configured', () => {
    const cal = buildCalendar({});
    expect(isWorkingDay(d('2026-09-07'), cal)).toBe(true); // Monday
    expect(isWorkingDay(d('2026-09-06'), cal)).toBe(false); // Sunday
  });

  it('accepts holiday dates as strings or Dates and ignores invalid ones', () => {
    const cal = buildCalendar({ holidays: [{ date: '2026-09-15', name: 'A' }, { date: 'nope', name: 'B' }] });
    expect(isHoliday(d('2026-09-15'), cal)).toBe(true);
    expect(cal.holidays.size).toBe(1);
  });
});

describe('workingDays.isWorkingDay', () => {
  it('treats configured weekdays as working and others as weekend', () => {
    expect(isWeekend(d('2026-09-05'), monFri)).toBe(true); // Saturday
    expect(isWeekend(d('2026-09-07'), monFri)).toBe(false); // Monday
  });

  it('treats configured holidays as non-working', () => {
    expect(isWorkingDay(d('2026-09-14'), monFri)).toBe(false);
    expect(isHoliday(d('2026-09-14'), monFri)).toBe(true);
  });

  it('supports a custom working week (Sunday–Thursday)', () => {
    const sunThu = buildCalendar({ workingDays: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'] });
    expect(isWorkingDay(d('2026-09-06'), sunThu)).toBe(true); // Sunday
    expect(isWorkingDay(d('2026-09-04'), sunThu)).toBe(false); // Friday
    expect(isWorkingDay(d('2026-09-05'), sunThu)).toBe(false); // Saturday
  });

  it('supports a six-day week', () => {
    const sixDay = buildCalendar({ workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] });
    expect(countWorkingDays(d('2026-09-07'), d('2026-09-13'), sixDay)).toBe(6);
  });
});

describe('workingDays.countWorkingDays', () => {
  it('counts only working days in a range spanning a weekend', () => {
    // Thu 3 → Tue 8: Thu, Fri, (Sat, Sun), Mon, Tue = 4
    expect(countWorkingDays(d('2026-09-03'), d('2026-09-08'), monFri)).toBe(4);
  });

  it('excludes a holiday that falls on a working day', () => {
    // Mon 14 (holiday) → Wed 16 = 2
    expect(countWorkingDays(d('2026-09-14'), d('2026-09-16'), monFri)).toBe(2);
  });

  it('does not double-count a holiday that falls on a weekend', () => {
    const cal = buildCalendar({ holidays: [{ date: d('2026-09-05'), name: 'Saturday holiday' }] });
    // Fri 4 → Mon 7: Fri, (Sat holiday+weekend), (Sun), Mon = 2
    const classified = classifyRange(d('2026-09-04'), d('2026-09-07'), cal);
    expect(classified.map((x) => x.working)).toEqual([true, false, false, true]);
    expect(classified[1].weekend).toBe(true);
    expect(classified[1].holiday).toBeNull(); // reported as weekend, not holiday
    expect(countWorkingDays(d('2026-09-04'), d('2026-09-07'), cal)).toBe(2);
  });

  it('returns 0 for a range that is entirely weekend', () => {
    expect(countWorkingDays(d('2026-09-05'), d('2026-09-06'), monFri)).toBe(0);
  });

  it('returns 0 when end is before start', () => {
    expect(countWorkingDays(d('2026-09-08'), d('2026-09-07'), monFri)).toBe(0);
    expect(listWorkingDays(d('2026-09-08'), d('2026-09-07'), monFri)).toEqual([]);
  });

  it('counts a whole month correctly', () => {
    const { start, end } = monthRange('2026-09');
    expect(countCalendarDays(start, end)).toBe(30);
    // 22 weekdays in Sep 2026 minus the Founders Day holiday = 21
    expect(countWorkingDays(start, end, monFri)).toBe(21);
  });

  it('lists the exact working day keys', () => {
    const days = listWorkingDays(d('2026-09-11'), d('2026-09-15'), monFri).map((x) => x.toISOString().slice(0, 10));
    // Fri 11, (Sat, Sun), (Mon 14 holiday), Tue 15
    expect(days).toEqual(['2026-09-11', '2026-09-15']);
  });
});

describe('workingDays.monthRange', () => {
  it('handles February in a leap year and December', () => {
    expect(monthRange('2028-02').end.toISOString()).toBe('2028-02-29T00:00:00.000Z');
    expect(monthRange('2026-12').end.toISOString()).toBe('2026-12-31T00:00:00.000Z');
    expect(monthRange('2026-12').start.toISOString()).toBe('2026-12-01T00:00:00.000Z');
  });
});

describe('leaveCalculations', () => {
  it('charges a single working day as 1', () => {
    expect(calculateLeaveDays(d('2026-09-07'), d('2026-09-07'), monFri)).toBe(1);
  });

  it('does not charge weekend days inside a leave range', () => {
    // Fri 4 → Mon 7 = 2 working days (calendar days = 4)
    const summary = summarizeLeaveRange(d('2026-09-04'), d('2026-09-07'), monFri);
    expect(summary).toMatchObject({ days: 2, calendarDays: 4, weekendDays: 2, holidayDays: 0 });
  });

  it('does not charge holidays inside a leave range and names them', () => {
    // Fri 11 → Tue 15 = Fri, Tue (2); Sat/Sun weekend; Mon holiday
    const summary = summarizeLeaveRange(d('2026-09-11'), d('2026-09-15'), monFri);
    expect(summary).toMatchObject({ days: 2, calendarDays: 5, weekendDays: 2, holidayDays: 1, holidays: ['Founders Day'] });
  });

  it('charges consecutive working days fully', () => {
    expect(calculateLeaveDays(d('2026-09-07'), d('2026-09-11'), monFri)).toBe(5);
  });

  it('charges 0 for a weekend-only range', () => {
    expect(calculateLeaveDays(d('2026-09-12'), d('2026-09-13'), monFri)).toBe(0);
  });

  it('uses the custom working week when counting', () => {
    const sunThu = buildCalendar({ workingDays: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'] });
    // Thu 3 → Sun 6: Thu, (Fri, Sat off), Sun = 2
    expect(calculateLeaveDays(d('2026-09-03'), d('2026-09-06'), sunThu)).toBe(2);
  });

  it('ignores time-of-day components', () => {
    const start = new Date('2026-09-07T22:00:00Z');
    const end = new Date('2026-09-08T01:00:00Z');
    expect(calculateLeaveDays(start, end, monFri)).toBe(2);
  });
});
