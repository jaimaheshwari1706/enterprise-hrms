import api from './axiosInstance';

export const authApi = {
  login: (credentials) => api.post('/auth/login', credentials),
  logout: () => api.post('/auth/logout'),
  // Revokes every session for the account, including this one.
  logoutAll: () => api.post('/auth/logout-all'),
  sessions: (config) => api.get('/auth/sessions', config),
  revokeSession: (id) => api.delete(`/auth/sessions/${id}`),
  refreshToken: () => api.post('/auth/refresh-token'),
  me: () => api.get('/auth/me'),
  forgotPassword: (email) => api.post('/auth/forgot-password', { email }),
  resetPassword: (token, password) => api.post('/auth/reset-password', { token, password }),
};
