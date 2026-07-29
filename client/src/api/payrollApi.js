import api from './axiosInstance';

export const payrollApi = {
  getSalary: (employeeId) => api.get(`/payroll/salary/${employeeId}`),
  updateSalary: (employeeId, payload) => api.put(`/payroll/salary/${employeeId}`, payload),
  generate: (payload) => api.post('/payroll/generate', payload),
  list: (params) => api.get('/payroll', { params }),
  myPayroll: (params) => api.get('/payroll/me', { params }),
  updateStatus: (id, status) => api.patch(`/payroll/${id}/status`, { status }),
};
