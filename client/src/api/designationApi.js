import api from './axiosInstance';

export const designationApi = {
  list: (params) => api.get('/designations', { params }),
  get: (id) => api.get(`/designations/${id}`),
  create: (payload) => api.post('/designations', payload),
  update: (id, payload) => api.put(`/designations/${id}`, payload),
  remove: (id) => api.delete(`/designations/${id}`),
};
