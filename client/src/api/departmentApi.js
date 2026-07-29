import api from './axiosInstance';

export const departmentApi = {
  list: (params) => api.get('/departments', { params }),
  get: (id) => api.get(`/departments/${id}`),
  create: (payload) => api.post('/departments', payload),
  update: (id, payload) => api.put(`/departments/${id}`, payload),
  remove: (id) => api.delete(`/departments/${id}`),
};
