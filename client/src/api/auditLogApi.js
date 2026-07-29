import api from './axiosInstance';

export const auditLogApi = {
  list: (params) => api.get('/audit-logs', { params }),
  actions: () => api.get('/audit-logs/actions'),
};
