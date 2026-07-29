import api from './axiosInstance';

export const dashboardApi = {
  hr: () => api.get('/dashboard/hr'),
  manager: () => api.get('/dashboard/manager'),
  employee: () => api.get('/dashboard/employee'),
};
