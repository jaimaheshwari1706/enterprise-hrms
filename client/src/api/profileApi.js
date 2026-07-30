import api from './axiosInstance';

export const profileApi = {
  get: () => api.get('/profile/me'),
  update: (payload) => api.put('/profile/me', payload),
  changePassword: (payload) => api.put('/profile/me/password', payload),
  uploadAvatar: (file) => {
    const formData = new FormData();
    formData.append('avatar', file);
    // Leave Content-Type unset so axios/XHR can generate the multipart
    // boundary itself — see the comment in employeeApi.uploadProfileImage.
    return api.post('/profile/me/avatar', formData);
  },
};
