import api from './axiosInstance';

export const organizationApi = {
  get: () => api.get('/organization'),
  update: (payload) => api.put('/organization', payload),
  uploadLogo: (file) => {
    const formData = new FormData();
    formData.append('logo', file);
    return api.post('/organization/logo', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};
