import api from './axiosInstance';

export const dashboardApi = {
  hr: (config) => api.get('/dashboard/hr', config),
  manager: (config) => api.get('/dashboard/manager', config),
  employee: (config) => api.get('/dashboard/employee', config),
};
