import api from './axiosInstance';

export const auditLogApi = {
  list: (params, config) => api.get('/audit-logs', { params, ...config }),
  actions: (config) => api.get('/audit-logs/actions', config),
};
