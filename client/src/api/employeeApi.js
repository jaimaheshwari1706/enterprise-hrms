import api from './axiosInstance';

export const employeeApi = {
  list: (params) => api.get('/employees', { params }),
  search: (q) => api.get('/employees/search', { params: { q } }),
  get: (id) => api.get(`/employees/${id}`),
  create: (payload) => api.post('/employees', payload),
  update: (id, payload) => api.put(`/employees/${id}`, payload),
  updateStatus: (id, status) => api.patch(`/employees/${id}/status`, { status }),
  uploadProfileImage: (id, file) => {
    const formData = new FormData();
    formData.append('profileImage', file);
    return api.post(`/employees/${id}/profile-image`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};
