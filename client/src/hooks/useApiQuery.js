import { useCallback, useEffect, useRef, useState } from 'react';
import { getApiErrorMessage, isCancelledRequest } from '../utils/apiError';

// Small data-fetching hook shared by every list/detail page.
//
//   const { data, pagination, status, error, refetch, isFetching } = useApiQuery(
//     (signal) => employeeApi.list(params, { signal }),
//     [params]
//   );
//
// - Cancels the in-flight request when deps change or the component
//   unmounts, so a slow earlier response can never overwrite a newer one.
// - Keeps the previous data visible while refetching (tables don't flash
//   to a spinner on every filter keystroke); `isFetching` drives a subtle
//   indicator instead.
// - `status` is 'loading' only for the very first load with no data.
export function useApiQuery(fetcher, deps = [], { enabled = true, select } = {}) {
  const [state, setState] = useState({ data: undefined, pagination: null, meta: null, status: enabled ? 'loading' : 'idle', error: null });
  const [isFetching, setIsFetching] = useState(enabled);
  const controllerRef = useRef(null);
  const requestIdRef = useRef(0);
  const fetcherRef = useRef(fetcher);
  const selectRef = useRef(select);
  fetcherRef.current = fetcher;
  selectRef.current = select;

  const run = useCallback(async () => {
    if (!enabled) return;
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    const requestId = ++requestIdRef.current;

    setIsFetching(true);
    setState((prev) => (prev.data === undefined ? { ...prev, status: 'loading', error: null } : { ...prev, error: null }));

    try {
      const response = await fetcherRef.current(controller.signal);
      if (requestId !== requestIdRef.current) return; // stale
      const body = response?.data ?? {};
      const data = selectRef.current ? selectRef.current(body) : body.data;
      setState({ data, pagination: body.pagination || null, meta: body.meta || null, status: 'ready', error: null });
    } catch (err) {
      if (isCancelledRequest(err) || requestId !== requestIdRef.current) return;
      setState((prev) => ({ ...prev, status: prev.data === undefined ? 'error' : 'ready', error: getApiErrorMessage(err) }));
    } finally {
      if (requestId === requestIdRef.current) setIsFetching(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, ...deps]);

  useEffect(() => {
    run();
    return () => controllerRef.current?.abort();
  }, [run]);

  // Optimistic local patch (e.g. mark a row as read) without a round-trip.
  const setData = useCallback((updater) => {
    setState((prev) => ({ ...prev, data: typeof updater === 'function' ? updater(prev.data) : updater }));
  }, []);

  return { ...state, isFetching, refetch: run, setData };
}
