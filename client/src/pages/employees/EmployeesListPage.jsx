import { useCallback, useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Search, Eye, Power, Download } from 'lucide-react';
import { employeeApi } from '../../api/employeeApi';
import { departmentApi } from '../../api/departmentApi';
import { exportApi } from '../../api/exportApi';
import { selectCurrentUser } from '../../features/auth/authSlice';
import { useToast } from '../../components/ToastProvider';
import useDebounce from '../../hooks/useDebounce';
import Button from '../../components/Button';
import Avatar from '../../components/Avatar';
import StatusBadge from '../../components/StatusBadge';
import Pagination from '../../components/Pagination';
import ConfirmDialog from '../../components/ConfirmDialog';
import { EmptyState, ErrorState, Loading } from '../../components/StateViews';

export default function EmployeesListPage() {
  const user = useSelector(selectCurrentUser);
  const canManage = user?.role === 'HR_ADMIN' || user?.role === 'SUPER_ADMIN';
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search);
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);

  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [status, setStatus] = useState('loading');

  const [statusTarget, setStatusTarget] = useState(null);
  const [togglingStatus, setTogglingStatus] = useState(false);
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      await exportApi.employees({
        search: debouncedSearch || undefined,
        department: departmentFilter || undefined,
        status: statusFilter || undefined,
      });
    } catch {
      showToast('Failed to export employees', 'error');
    } finally {
      setExporting(false);
    }
  };

  useEffect(() => {
    departmentApi.list({ limit: 100, status: 'active' }).then(({ data }) => setDepartments(data.data));
  }, []);

  const fetchEmployees = useCallback(async () => {
    setStatus('loading');
    try {
      const { data } = await employeeApi.list({
        page,
        limit: 10,
        search: debouncedSearch || undefined,
        department: departmentFilter || undefined,
        status: statusFilter || undefined,
      });
      setEmployees(data.data);
      setPagination(data.pagination);
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  }, [page, debouncedSearch, departmentFilter, statusFilter]);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, departmentFilter, statusFilter]);

  const handleToggleStatus = async () => {
    setTogglingStatus(true);
    const nextStatus = statusTarget.status === 'active' ? 'inactive' : 'active';
    try {
      await employeeApi.updateStatus(statusTarget._id, nextStatus);
      showToast(`Employee ${nextStatus === 'active' ? 'activated' : 'deactivated'} successfully`);
      setStatusTarget(null);
      fetchEmployees();
    } catch (err) {
      showToast(err.response?.data?.message || 'Unable to update status', 'error');
    } finally {
      setTogglingStatus(false);
    }
  };

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-white">
            {user?.role === 'MANAGER' ? 'My Team' : 'Employees'}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {user?.role === 'MANAGER' ? 'Employees reporting to you.' : 'Manage your organization\'s workforce.'}
          </p>
        </div>
        {canManage && (
          <div className="flex gap-2">
            <Button variant="secondary" onClick={handleExport} disabled={exporting}>
              <Download size={16} /> {exporting ? 'Exporting…' : 'Export'}
            </Button>
            <Button onClick={() => navigate('/employees/new')}>
              <Plus size={16} /> Add Employee
            </Button>
          </div>
        )}
      </div>

      <div className="mb-4 flex flex-wrap gap-3">
        <div className="relative max-w-xs flex-1">
          <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, ID, or email…"
            className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          />
        </div>
        <select
          value={departmentFilter}
          onChange={(e) => setDepartmentFilter(e.target.value)}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
        >
          <option value="">All departments</option>
          {departments.map((d) => (
            <option key={d._id} value={d._id}>
              {d.name}
            </option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
        >
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        {status === 'loading' && <Loading label="Loading employees…" />}
        {status === 'error' && <ErrorState message="Failed to load employees. Please try again." />}
        {status === 'ready' && employees.length === 0 && (
          <EmptyState
            title="No employees found"
            message={search ? 'Try a different search term.' : 'Get started by adding your first employee.'}
          />
        )}

        {status === 'ready' && employees.length > 0 && (
          <>
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 text-xs uppercase text-slate-500 dark:border-slate-800 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3 font-medium">Employee</th>
                  <th className="px-4 py-3 font-medium">Department</th>
                  <th className="px-4 py-3 font-medium">Designation</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {employees.map((emp) => (
                  <tr key={emp._id} className="text-slate-700 dark:text-slate-200">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar src={emp.profileImageUrl} name={`${emp.firstName} ${emp.lastName}`} />
                        <div>
                          <p className="font-medium">{emp.firstName} {emp.lastName}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">{emp.employeeId} · {emp.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{emp.department?.name || '—'}</td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{emp.designation?.name || '—'}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={emp.status} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <Link
                          to={`/employees/${emp._id}`}
                          className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                        >
                          <Eye size={15} />
                        </Link>
                        {canManage && (
                          <button
                            onClick={() => setStatusTarget(emp)}
                            title={emp.status === 'active' ? 'Deactivate' : 'Activate'}
                            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                          >
                            <Power size={15} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination pagination={pagination} onPageChange={setPage} />
          </>
        )}
      </div>

      <ConfirmDialog
        open={Boolean(statusTarget)}
        onClose={() => setStatusTarget(null)}
        onConfirm={handleToggleStatus}
        title={statusTarget?.status === 'active' ? 'Deactivate employee' : 'Activate employee'}
        message={`Are you sure you want to ${statusTarget?.status === 'active' ? 'deactivate' : 'activate'} ${statusTarget?.firstName} ${statusTarget?.lastName}? ${
          statusTarget?.status === 'active' ? 'Their login access will be revoked.' : 'Their login access will be restored.'
        }`}
        confirmLabel={statusTarget?.status === 'active' ? 'Deactivate' : 'Activate'}
        loading={togglingStatus}
      />
    </div>
  );
}
