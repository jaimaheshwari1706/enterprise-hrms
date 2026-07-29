import api from './axiosInstance';

export const leaveApi = {
  leaveTypes: () => api.get('/leaves/leave-types'),
  apply: (payload) => api.post('/leaves/apply', payload),
  myLeaves: (params) => api.get('/leaves/me', { params }),
  cancel: (id) => api.patch(`/leaves/${id}/cancel`),
  list: (params) => api.get('/leaves', { params }),
  approve: (id, comment) => api.patch(`/leaves/${id}/approve`, { comment }),
  reject: (id, comment) => api.patch(`/leaves/${id}/reject`, { comment }),
};
