import axios from 'axios';
import { store } from '../app/store';
import { sessionExpired, setAccessToken } from '../features/auth/authSlice';

// Single axios instance used by every api/*.js module. Keeping the base
// URL, auth header, and refresh-token logic here means feature code never
// touches axios configuration directly.
const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api',
  withCredentials: true, // refresh token cookie is httpOnly
  // Render's free tier spins the API down when idle and takes 30-60s to
  // wake; a 30s timeout cancelled the very first login/refresh before the
  // server ever answered (the preflight stayed "pending"). 75s covers a
  // cold start; interactive requests on a warm server still fail fast on
  // real network errors.
  timeout: 75000,
});

api.interceptors.request.use((config) => {
  const token = store.getState().auth.accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// If a request fails with 401, try refreshing the access token once, then
// retry the original request. If the refresh itself fails, end the session
// (the login page explains why). Concurrent 401s share one refresh call.
let refreshPromise = null;

function refreshAccessToken() {
  if (!refreshPromise) {
    refreshPromise = api
      .post('/auth/refresh-token')
      .then(({ data }) => {
        const token = data.data.accessToken;
        store.dispatch(setAccessToken(token));
        return token;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const status = error.response?.status;
    const code = error.response?.data?.code;
    const isAuthRoute = originalRequest?.url?.includes('/auth/refresh-token') || originalRequest?.url?.includes('/auth/login');

    // Only an *expired or missing* access token is worth a refresh. A token
    // the server calls invalid, or a deactivated account, is a hard stop.
    const refreshable = status === 401 && !isAuthRoute && !originalRequest._retry && code !== 'TOKEN_INVALID' && code !== 'ACCOUNT_INACTIVE' && code !== 'SESSION_REVOKED';

    if (refreshable) {
      originalRequest._retry = true;
      try {
        const token = await refreshAccessToken();
        originalRequest.headers.Authorization = `Bearer ${token}`;
        return api(originalRequest);
      } catch (refreshError) {
        if (store.getState().auth.status === 'authenticated') {
          store.dispatch(sessionExpired());
        }
        return Promise.reject(refreshError);
      }
    }

    if (status === 401 && !isAuthRoute && store.getState().auth.status === 'authenticated') {
      store.dispatch(sessionExpired());
    }

    return Promise.reject(error);
  }
);

export default api;
