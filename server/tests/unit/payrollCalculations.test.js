const { calculateGrossSalary, calculateNetSalary } = require('../../src/utils/payrollCalculations');

describe('payrollCalculations', () => {
  describe('calculateGrossSalary', () => {
    it('sums basic + hra + allowances', () => {
      expect(calculateGrossSalary({ basic: 50000, hra: 20000, allowances: 5000 })).toBe(75000);
    });

    it('handles all-zero salary components', () => {
      expect(calculateGrossSalary({ basic: 0, hra: 0, allowances: 0 })).toBe(0);
    });
  });

  describe('calculateNetSalary', () => {
    it('subtracts deductions from the gross salary', () => {
      expect(
        calculateNetSalary({ basic: 50000, hra: 20000, allowances: 5000, deductions: 3000 })
      ).toBe(72000);
    });

    it('can go negative if deductions exceed gross (surfaces bad input rather than hiding it)', () => {
      expect(
        calculateNetSalary({ basic: 1000, hra: 0, allowances: 0, deductions: 5000 })
      ).toBe(-4000);
    });
  });
});
