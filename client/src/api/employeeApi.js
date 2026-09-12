import api from './axiosInstance';

export const employeeApi = {
  list: (params, config) => api.get('/employees', { params, ...config }),
  options: (config) => api.get('/employees/options', config),
  search: (q, config) => api.get('/employees/search', { params: { q }, ...config }),
  get: (id, config) => api.get(`/employees/${id}`, config),
  create: (payload) => api.post('/employees', payload),
  update: (id, payload) => api.put(`/employees/${id}`, payload),
  // exitDate (YYYY-MM-DD) is the last working day when deactivating.
  updateStatus: (id, status, exitDate) => api.patch(`/employees/${id}/status`, exitDate ? { status, exitDate } : { status }),
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
