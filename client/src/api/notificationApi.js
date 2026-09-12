import api from './axiosInstance';

export const notificationApi = {
  list: (params, config) => api.get('/notifications', { params, ...config }),
  markRead: (id) => api.patch(`/notifications/${id}/read`),
  markAllRead: () => api.patch('/notifications/read-all'),
};
