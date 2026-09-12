import api from './axiosInstance';

export const leaveApi = {
  leaveTypes: (config) => api.get('/leaves/leave-types', config),
  createLeaveType: (payload) => api.post('/leaves/leave-types', payload),
  updateLeaveType: (id, payload) => api.put(`/leaves/leave-types/${id}`, payload),
  // Working-day count the server will charge for a range (weekends and
  // holidays excluded) — the single source of truth for the leave form.
  preview: (startDate, endDate, config) => api.get('/leaves/preview', { params: { startDate, endDate }, ...config }),
  apply: (payload) => api.post('/leaves/apply', payload),
  myLeaves: (params, config) => api.get('/leaves/me', { params, ...config }),
  myBalance: (config) => api.get('/leaves/me/balance', config),
  cancel: (id) => api.patch(`/leaves/${id}/cancel`),
  list: (params, config) => api.get('/leaves', { params, ...config }),
  approve: (id, comment) => api.patch(`/leaves/${id}/approve`, { comment }),
  reject: (id, comment) => api.patch(`/leaves/${id}/reject`, { comment }),
};
