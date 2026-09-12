import api from './axiosInstance';

export const departmentApi = {
  list: (params, config) => api.get('/departments', { params, ...config }),
  get: (id, config) => api.get(`/departments/${id}`, config),
  create: (payload) => api.post('/departments', payload),
  update: (id, payload) => api.put(`/departments/${id}`, payload),
  remove: (id) => api.delete(`/departments/${id}`),
};
