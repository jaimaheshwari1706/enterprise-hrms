const { getPagination, buildPaginationMeta } = require('../../src/utils/pagination');

describe('pagination', () => {
  describe('getPagination', () => {
    it('defaults to page 1, limit 10 when nothing is provided', () => {
      expect(getPagination({})).toEqual({ page: 1, limit: 10, skip: 0 });
    });

    it('computes skip correctly for later pages', () => {
      expect(getPagination({ page: '3', limit: '20' })).toEqual({ page: 3, limit: 20, skip: 40 });
    });

    it('clamps page below 1 up to 1', () => {
      expect(getPagination({ page: '-5' }).page).toBe(1);
    });

    it('clamps limit above 100 down to 100', () => {
      expect(getPagination({ limit: '9999' }).limit).toBe(100);
    });

    it('ignores garbage input and falls back to defaults', () => {
      expect(getPagination({ page: 'abc', limit: 'xyz' })).toEqual({ page: 1, limit: 10, skip: 0 });
    });
  });

  describe('buildPaginationMeta', () => {
    it('computes total pages correctly, rounding up', () => {
      expect(buildPaginationMeta(1, 10, 25)).toEqual({ page: 1, limit: 10, total: 25, pages: 3 });
    });

    it('returns at least 1 page even when total is 0', () => {
      expect(buildPaginationMeta(1, 10, 0).pages).toBe(1);
    });
  });
});
