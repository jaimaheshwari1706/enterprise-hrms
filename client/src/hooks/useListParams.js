import { useCallback, useMemo, useState } from 'react';

// Page / page-size / sort / filter state for a paginated list, with the
// "reset to page 1 whenever a filter or sort changes" rule built in so
// every page behaves identically.
//
//   const list = useListParams({ pageSize: 10, sort: '-createdAt', filters: { status: '' } });
//   list.params            -> { page, limit, sort, ...filters } ready for the API
//   list.setFilter('status', 'active')
//   list.setSort('-name'); list.setPage(2); list.setPageSize(25)
export function useListParams({ pageSize = 10, sort = '', filters = {} } = {}) {
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(pageSize);
  const [sortValue, setSortValue] = useState(sort);
  const [filterValues, setFilterValues] = useState(filters);

  const setFilter = useCallback((key, value) => {
    setFilterValues((prev) => (prev[key] === value ? prev : { ...prev, [key]: value }));
    setPage(1);
  }, []);

  const setFilters = useCallback((next) => {
    setFilterValues((prev) => ({ ...prev, ...next }));
    setPage(1);
  }, []);

  const resetFilters = useCallback(() => {
    setFilterValues(filters);
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setSort = useCallback((value) => {
    setSortValue(value);
    setPage(1);
  }, []);

  const setPageSize = useCallback((value) => {
    setLimit(value);
    setPage(1);
  }, []);

  const params = useMemo(() => {
    const out = { page, limit };
    if (sortValue) out.sort = sortValue;
    for (const [key, value] of Object.entries(filterValues)) {
      if (value !== '' && value !== null && value !== undefined) out[key] = value;
    }
    return out;
  }, [page, limit, sortValue, filterValues]);

  const hasActiveFilters = useMemo(
    () => Object.entries(filterValues).some(([key, value]) => value !== '' && value !== filters[key]),
    [filterValues, filters]
  );

  return {
    page,
    limit,
    sort: sortValue,
    filters: filterValues,
    params,
    hasActiveFilters,
    setPage,
    setPageSize,
    setSort,
    setFilter,
    setFilters,
    resetFilters,
  };
}
