import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

// The real axios instance + real store, with the network replaced by an
// adapter so the interceptors (silent refresh, retry, session expiry) run
// for real. Modules are reset per test so every test starts from the
// `idle` state a fresh page load has.
let store;
let api;
let auth;
let ProtectedRoute;

async function fresh() {
  vi.resetModules();
  ({ store } = await import('../../app/store'));
  api = (await import('../../api/axiosInstance')).default;
  auth = await import('./authSlice');
  ProtectedRoute = (await import('../../routes/ProtectedRoute')).default;
}

function withAdapter(handler) {
  api.defaults.adapter = async (config) => {
    const result = await handler(config);
    if (result.status >= 400) {
      const err = new Error(`Request failed with status ${result.status}`);
      err.config = config;
      err.response = { ...result, config };
      err.isAxiosError = true;
      throw err;
    }
    return { ...result, config, headers: {}, statusText: 'OK' };
  };
}

const user = { id: 'u1', email: 'eve@test.com', role: 'EMPLOYEE', employee: { _id: 'e1', firstName: 'Eve' } };
const ok = (data) => ({ status: 200, data: { success: true, data } });
const fail = (status, message, code) => ({ status, data: { success: false, message, code } });

async function signIn(token = 'access-1') {
  withAdapter((config) => (config.url === '/auth/login' ? ok({ user, accessToken: token }) : fail(404)));
  await store.dispatch(auth.loginUser({ email: user.email, password: 'x' }));
  expect(auth.selectAuthStatus(store.getState())).toBe('authenticated');
}

beforeEach(async () => {
  await fresh();
});

describe('authentication flow', () => {
  it('login stores the user and access token; a failed login records the server message', async () => {
    await signIn();
    expect(auth.selectCurrentUser(store.getState())).toEqual(user);
    expect(store.getState().auth.accessToken).toBe('access-1');

    store.dispatch(auth.logout());
    withAdapter(() => fail(401, 'Invalid email or password'));
    await store.dispatch(auth.loginUser({ email: user.email, password: 'wrong' }));
    expect(auth.selectAuthStatus(store.getState())).toBe('unauthenticated');
    expect(store.getState().auth.error).toBe('Invalid email or password');
  });

  it('restores the session on page load via the refresh cookie (bootstrapAuth)', async () => {
    const calls = [];
    withAdapter((config) => {
      calls.push(config.url);
      return config.url === '/auth/refresh-token' ? ok({ user, accessToken: 'restored' }) : fail(404);
    });
    expect(auth.selectAuthStatus(store.getState())).toBe('idle');
    await store.dispatch(auth.bootstrapAuth());
    expect(calls).toEqual(['/auth/refresh-token']);
    expect(auth.selectAuthStatus(store.getState())).toBe('authenticated');
    expect(store.getState().auth.accessToken).toBe('restored');
    expect(auth.selectCurrentUser(store.getState())).toEqual(user);
  });

  it('only one bootstrap call reaches the network even if dispatched twice (StrictMode)', async () => {
    let hits = 0;
    withAdapter(() => {
      hits += 1;
      return ok({ user, accessToken: 'restored' });
    });
    await Promise.all([store.dispatch(auth.bootstrapAuth()), store.dispatch(auth.bootstrapAuth())]);
    expect(hits).toBe(1);
  });

  it('a missing/invalid refresh cookie leaves the user signed out without a session-expired banner', async () => {
    withAdapter(() => fail(401, 'No refresh token provided', 'NO_REFRESH_TOKEN'));
    await store.dispatch(auth.bootstrapAuth());
    expect(auth.selectAuthStatus(store.getState())).toBe('unauthenticated');
    expect(auth.selectSessionExpired(store.getState())).toBe(false);
  });

  it('attaches the bearer token, silently refreshes on TOKEN_EXPIRED and retries the request once', async () => {
    await signIn('old-token');
    const seen = [];
    withAdapter((config) => {
      seen.push({ url: config.url, auth: config.headers.Authorization });
      if (config.url === '/auth/refresh-token') return ok({ user, accessToken: 'new-token' });
      if (config.url === '/profile/me') {
        return config.headers.Authorization === 'Bearer new-token' ? ok({ id: 'u1' }) : fail(401, 'Access token has expired', 'TOKEN_EXPIRED');
      }
      return fail(404);
    });

    const res = await api.get('/profile/me');
    expect(res.data.data.id).toBe('u1');
    expect(seen.map((s) => s.url)).toEqual(['/profile/me', '/auth/refresh-token', '/profile/me']);
    expect(seen[0].auth).toBe('Bearer old-token');
    expect(seen[2].auth).toBe('Bearer new-token');
    expect(store.getState().auth.accessToken).toBe('new-token');
  });

  it('shares a single refresh between concurrent 401s', async () => {
    await signIn('old-token');
    let refreshes = 0;
    withAdapter((config) => {
      if (config.url === '/auth/refresh-token') {
        refreshes += 1;
        return ok({ user, accessToken: 'new-token' });
      }
      return config.headers.Authorization === 'Bearer new-token' ? ok(config.url) : fail(401, 'expired', 'TOKEN_EXPIRED');
    });
    const [a, b] = await Promise.all([api.get('/a'), api.get('/b')]);
    expect(a.data.data).toBe('/a');
    expect(b.data.data).toBe('/b');
    expect(refreshes).toBe(1);
  });

  it('ends the session (sessionExpired) when the refresh itself fails', async () => {
    await signIn('old-token');
    withAdapter((config) => {
      if (config.url === '/auth/refresh-token') return fail(401, 'Refresh token is no longer valid', 'REFRESH_REVOKED');
      return fail(401, 'Access token has expired', 'TOKEN_EXPIRED');
    });
    await expect(api.get('/leaves/me')).rejects.toBeTruthy();
    expect(auth.selectAuthStatus(store.getState())).toBe('unauthenticated');
    expect(auth.selectSessionExpired(store.getState())).toBe(true);
    expect(store.getState().auth.accessToken).toBeNull();
  });

  it('treats SESSION_REVOKED / TOKEN_INVALID as a hard sign-out without attempting a refresh', async () => {
    await signIn('old-token');
    const urls = [];
    withAdapter((config) => {
      urls.push(config.url);
      return fail(401, 'This session has been signed out', 'SESSION_REVOKED');
    });
    await expect(api.get('/leaves/me')).rejects.toBeTruthy();
    expect(urls).toEqual(['/leaves/me']);
    expect(auth.selectSessionExpired(store.getState())).toBe(true);
  });

  it('logout clears local state even if the server call fails', async () => {
    await signIn();
    withAdapter(() => fail(500, 'boom'));
    await store.dispatch(auth.logoutUser());
    expect(auth.selectAuthStatus(store.getState())).toBe('unauthenticated');
    expect(auth.selectCurrentUser(store.getState())).toBeNull();
    expect(store.getState().auth.accessToken).toBeNull();
  });
});

describe('ProtectedRoute', () => {
  function renderAt(path) {
    return render(
      <Provider store={store}>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/login" element={<p>Login page</p>} />
            <Route element={<ProtectedRoute />}>
              <Route path="/dashboard" element={<p>Dashboard</p>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </Provider>
    );
  }

  it('shows a splash while the session is being restored, then the page once authenticated', async () => {
    let resolveRefresh;
    withAdapter(() => new Promise((resolve) => { resolveRefresh = resolve; }));
    const pending = store.dispatch(auth.bootstrapAuth());
    renderAt('/dashboard');
    expect(auth.selectAuthStatus(store.getState())).toBe('loading');
    expect(screen.queryByText('Dashboard')).not.toBeInTheDocument();
    expect(screen.queryByText('Login page')).not.toBeInTheDocument();

    await waitFor(() => expect(resolveRefresh).toBeTypeOf('function'));
    resolveRefresh(ok({ user, accessToken: 'x' }));
    await pending;
    await waitFor(() => expect(screen.getByText('Dashboard')).toBeInTheDocument());
  });

  it('redirects unauthenticated users to /login', async () => {
    withAdapter(() => fail(401, 'No refresh token provided', 'NO_REFRESH_TOKEN'));
    await store.dispatch(auth.bootstrapAuth());
    renderAt('/dashboard');
    expect(screen.getByText('Login page')).toBeInTheDocument();
  });
});
