const { calculateWorkingHours, deriveAttendanceStatus } = require('../../src/utils/attendanceCalculations');

describe('attendanceCalculations', () => {
  describe('calculateWorkingHours', () => {
    it('computes hours worked between check-in and check-out', () => {
      const checkIn = new Date('2026-08-03T09:30:00');
      const checkOut = new Date('2026-08-03T18:00:00');
      expect(calculateWorkingHours(checkIn, checkOut)).toBe(8.5);
    });

    it('rounds to 2 decimal places', () => {
      const checkIn = new Date('2026-08-03T09:00:00');
      const checkOut = new Date('2026-08-03T09:20:00'); // 20 minutes = 0.333... hours
      expect(calculateWorkingHours(checkIn, checkOut)).toBe(0.33);
    });
  });

  describe('deriveAttendanceStatus', () => {
    it('marks 8+ hours as Present', () => {
      expect(deriveAttendanceStatus(8)).toBe('Present');
      expect(deriveAttendanceStatus(8.5)).toBe('Present');
    });

    it('marks under 8 hours as HalfDay', () => {
      expect(deriveAttendanceStatus(7.99)).toBe('HalfDay');
      expect(deriveAttendanceStatus(3)).toBe('HalfDay');
      expect(deriveAttendanceStatus(0)).toBe('HalfDay');
    });
  });
});
