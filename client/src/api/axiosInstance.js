import axios from 'axios';
import { store } from '../app/store';
import { logout, setAccessToken } from '../features/auth/authSlice';

// Single axios instance used by every api/*.js module. Keeping the base
// URL, auth header, and refresh-token logic here means feature code never
// touches axios configuration directly.
const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api',
  withCredentials: true, // refresh token cookie is httpOnly
});

api.interceptors.request.use((config) => {
  const token = store.getState().auth.accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// If a request fails with 401, try refreshing the access token once, then
// retry the original request. If the refresh itself fails, log the user out.
let isRefreshing = false;
let pendingQueue = [];

function resolveQueue(token) {
  pendingQueue.forEach((cb) => cb(token));
  pendingQueue = [];
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry && !originalRequest.url.includes('/auth/refresh-token')) {
      originalRequest._retry = true;

      if (isRefreshing) {
        return new Promise((resolve) => {
          pendingQueue.push((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            resolve(api(originalRequest));
          });
        });
      }

      isRefreshing = true;
      try {
        const { data } = await api.post('/auth/refresh-token');
        const newToken = data.data.accessToken;
        store.dispatch(setAccessToken(newToken));
        resolveQueue(newToken);
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        store.dispatch(logout());
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default api;
