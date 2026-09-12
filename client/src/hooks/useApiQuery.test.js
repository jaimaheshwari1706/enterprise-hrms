import { describe, it, expect, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useApiQuery } from './useApiQuery';

// A fetcher whose resolution the test controls, and which records the
// AbortSignal it was given so cancellation can be asserted.
function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function abortError() {
  const err = new Error('canceled');
  err.code = 'ERR_CANCELED';
  err.name = 'CanceledError';
  return err;
}

describe('useApiQuery', () => {
  it('starts in loading and resolves to ready with data, pagination and meta', async () => {
    const d = deferred();
    const fetcher = vi.fn(() => d.promise);
    const { result } = renderHook(() => useApiQuery(fetcher, []));

    expect(result.current.status).toBe('loading');
    expect(result.current.isFetching).toBe(true);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0][0]).toBeInstanceOf(AbortSignal);

    await act(async () => {
      d.resolve({ data: { data: [{ id: 1 }], pagination: { page: 1, pages: 1, total: 1, limit: 10 }, meta: { totals: 5 } } });
    });
    expect(result.current.status).toBe('ready');
    expect(result.current.data).toEqual([{ id: 1 }]);
    expect(result.current.pagination).toEqual({ page: 1, pages: 1, total: 1, limit: 10 });
    expect(result.current.meta).toEqual({ totals: 5 });
    expect(result.current.isFetching).toBe(false);
  });

  it('reports a failure as status "error" with a friendly message on first load', async () => {
    const d = deferred();
    const { result } = renderHook(() => useApiQuery(() => d.promise, []));
    await act(async () => {
      d.reject({ response: { status: 500, data: { message: 'Database exploded' } } });
    });
    expect(result.current.status).toBe('error');
    expect(result.current.error).toMatch(/exploded|server/i);
    expect(result.current.isFetching).toBe(false);
  });

  it('keeps existing data and status "ready" when a refetch fails', async () => {
    const first = deferred();
    const second = deferred();
    const fetcher = vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const { result } = renderHook(() => useApiQuery(fetcher, []));
    await act(async () => first.resolve({ data: { data: [1] } }));

    act(() => {
      result.current.refetch();
    });
    expect(result.current.isFetching).toBe(true);
    await act(async () => second.reject({ response: { status: 503, data: { message: 'Down' } } }));
    expect(result.current.status).toBe('ready');
    expect(result.current.data).toEqual([1]);
    expect(result.current.error).toBeTruthy();
  });

  it('aborts the in-flight request when the deps change and ignores its cancellation', async () => {
    const first = deferred();
    const second = deferred();
    const signals = [];
    const fetcher = vi.fn((signal) => {
      signals.push(signal);
      return signals.length === 1 ? first.promise : second.promise;
    });
    const { result, rerender } = renderHook(({ q }) => useApiQuery(fetcher, [q]), { initialProps: { q: 'a' } });

    rerender({ q: 'b' });
    expect(signals[0].aborted).toBe(true);
    expect(signals[1].aborted).toBe(false);

    // The aborted request rejects as axios would — must not surface as an error.
    await act(async () => first.reject(abortError()));
    expect(result.current.status).toBe('loading');
    expect(result.current.error).toBeNull();

    await act(async () => second.resolve({ data: { data: ['b'] } }));
    expect(result.current.data).toEqual(['b']);
  });

  it('never lets a slow, stale response overwrite a newer one', async () => {
    const first = deferred();
    const second = deferred();
    const fetcher = vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const { result, rerender } = renderHook(({ q }) => useApiQuery(fetcher, [q]), { initialProps: { q: 'a' } });
    rerender({ q: 'b' });

    await act(async () => second.resolve({ data: { data: ['fresh'] } }));
    expect(result.current.data).toEqual(['fresh']);

    // The first request "arrives" late (as if abort had not been honoured).
    await act(async () => first.resolve({ data: { data: ['stale'] } }));
    expect(result.current.data).toEqual(['fresh']);
    expect(result.current.isFetching).toBe(false);
  });

  it('aborts on unmount', async () => {
    let signal;
    const { unmount } = renderHook(() => useApiQuery((s) => { signal = s; return new Promise(() => {}); }, []));
    unmount();
    expect(signal.aborted).toBe(true);
  });

  it('does not fetch when disabled, and fetches once enabled', async () => {
    const fetcher = vi.fn(() => Promise.resolve({ data: { data: 'x' } }));
    const { result, rerender } = renderHook(({ enabled }) => useApiQuery(fetcher, [], { enabled }), { initialProps: { enabled: false } });
    expect(result.current.status).toBe('idle');
    expect(fetcher).not.toHaveBeenCalled();
    rerender({ enabled: true });
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.data).toBe('x');
  });

  it('supports select() and optimistic setData()', async () => {
    const fetcher = () => Promise.resolve({ data: { data: { items: [1, 2] } } });
    const { result } = renderHook(() => useApiQuery(fetcher, [], { select: (body) => body.data.items }));
    await waitFor(() => expect(result.current.data).toEqual([1, 2]));
    act(() => result.current.setData((prev) => [...prev, 3]));
    expect(result.current.data).toEqual([1, 2, 3]);
  });
});
