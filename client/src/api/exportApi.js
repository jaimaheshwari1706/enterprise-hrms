import api from './axiosInstance';

// Excel exports return a binary file, not JSON, so we request a blob and
// trigger a browser download rather than routing through the normal
// interceptor flow used by other API calls.
async function downloadFile(path, params, filename) {
  const response = await api.get(path, { params, responseType: 'blob' });
  const url = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

export const exportApi = {
  employees: (params) => downloadFile('/export/employees.xlsx', params, 'employees.xlsx'),
  attendance: (params) => downloadFile('/export/attendance.xlsx', params, 'attendance.xlsx'),
  leaves: (params) => downloadFile('/export/leaves.xlsx', params, 'leaves.xlsx'),
  payroll: (params) => downloadFile('/export/payroll.xlsx', params, 'payroll.xlsx'),
};
