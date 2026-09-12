import api from './axiosInstance';

export const designationApi = {
  list: (params, config) => api.get('/designations', { params, ...config }),
  get: (id, config) => api.get(`/designations/${id}`, config),
  create: (payload) => api.post('/designations', payload),
  update: (id, payload) => api.put(`/designations/${id}`, payload),
  remove: (id) => api.delete(`/designations/${id}`),
};
