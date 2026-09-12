import api from './axiosInstance';

export const attendanceApi = {
  checkIn: () => api.post('/attendance/check-in'),
  checkOut: () => api.post('/attendance/check-out'),
  today: (config) => api.get('/attendance/me/today', config),
  myHistory: (params, config) => api.get('/attendance/me/history', { params, ...config }),
  list: (params, config) => api.get('/attendance', { params, ...config }),
};
