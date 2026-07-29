import api from './axiosInstance';

export const attendanceApi = {
  checkIn: () => api.post('/attendance/check-in'),
  checkOut: () => api.post('/attendance/check-out'),
  today: () => api.get('/attendance/me/today'),
  myHistory: (params) => api.get('/attendance/me/history', { params }),
  list: (params) => api.get('/attendance', { params }),
};
