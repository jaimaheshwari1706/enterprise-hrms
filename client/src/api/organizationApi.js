import api from './axiosInstance';

export const organizationApi = {
  get: (config) => api.get('/organization', config),
  update: (payload) => api.put('/organization', payload),
  uploadLogo: (file) => {
    const formData = new FormData();
    formData.append('logo', file);
    // Leave Content-Type unset so axios/XHR can generate the multipart
    // boundary itself — see the comment in employeeApi.uploadProfileImage.
    return api.post('/organization/logo', formData);
  },
};
