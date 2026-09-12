import api from './axiosInstance';

// Excel exports return a binary file, not JSON, so we request a blob and
// trigger a browser download rather than routing through the normal
// interceptor flow used by other API calls.
async function downloadFile(path, params, filename) {
  const response = await api.get(path, { params, responseType: 'blob', timeout: 120000 });
  const url = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

const stamp = () => new Date().toISOString().slice(0, 10);

export const exportApi = {
  employees: (params) => downloadFile('/export/employees.xlsx', params, `employees-${stamp()}.xlsx`),
  attendance: (params) => downloadFile('/export/attendance.xlsx', params, `attendance-${stamp()}.xlsx`),
  leaves: (params) => downloadFile('/export/leaves.xlsx', params, `leave-requests-${stamp()}.xlsx`),
  payroll: (params) => downloadFile('/export/payroll.xlsx', params, `payroll-${stamp()}.xlsx`),
};
