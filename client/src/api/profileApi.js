import api from './axiosInstance';

export const profileApi = {
  get: () => api.get('/profile/me'),
  update: (payload) => api.put('/profile/me', payload),
  changePassword: (payload) => api.put('/profile/me/password', payload),
  uploadAvatar: (file) => {
    const formData = new FormData();
    formData.append('avatar', file);
    return api.post('/profile/me/avatar', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};
