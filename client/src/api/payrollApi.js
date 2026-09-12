import api from './axiosInstance';

export const payrollApi = {
  getSalary: (employeeId, config) => api.get(`/payroll/salary/${employeeId}`, config),
  listSalaries: (params, config) => api.get('/payroll/salaries', { params, ...config }),
  updateSalary: (employeeId, payload) => api.put(`/payroll/salary/${employeeId}`, payload),
  generate: (payload) => api.post('/payroll/generate', payload),
  list: (params, config) => api.get('/payroll', { params, ...config }),
  myPayroll: (params, config) => api.get('/payroll/me', { params, ...config }),
  // Full payslip (employee + organization + period snapshot).
  get: (id, config) => api.get(`/payroll/${id}`, config),
  updateStatus: (id, status) => api.patch(`/payroll/${id}/status`, { status }),
};
