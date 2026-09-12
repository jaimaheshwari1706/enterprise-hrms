import api from './axiosInstance';

export const searchApi = {
  // Role-scoped groups: { employees, departments, leaves, payroll }.
  global: (q, config) => api.get('/search', { params: { q }, ...config }),
};
