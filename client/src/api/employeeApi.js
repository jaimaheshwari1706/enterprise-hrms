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
    // No explicit Content-Type here: axios's default (XHR) adapter only
    // generates the multipart boundary itself when the header is left
    // unset. Setting 'multipart/form-data' manually (without a boundary)
    // sends a malformed body that the server's multer/busboy parser can't
    // read, so the upload silently fails with "no file uploaded".
    return api.post(`/employees/${id}/profile-image`, formData);
  },
};
