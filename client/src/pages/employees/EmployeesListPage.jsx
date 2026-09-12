import { useState } from 'react';
import { useSelector } from 'react-redux';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Eye, Power, Download, Pencil, MoreHorizontal, Users } from 'lucide-react';
import { employeeApi } from '../../api/employeeApi';
import { departmentApi } from '../../api/departmentApi';
import { exportApi } from '../../api/exportApi';
import { selectCurrentUser } from '../../features/auth/authSlice';
import { useToast } from '../../hooks/useToast';
import useDebounce from '../../hooks/useDebounce';
import { useApiQuery } from '../../hooks/useApiQuery';
import { useListParams } from '../../hooks/useListParams';
import {
  Button, IconButton, Select, SearchInput, Toolbar, Card, PageHeader, DataTable, Avatar, StatusBadge, ConfirmDialog, Dropdown, NoResults, FormField, Input,
} from '../../components/ui';
import { formatDate, fullName, todayInputValue } from '../../utils/format';
import { getApiErrorMessage } from '../../utils/apiError';

const EMPLOYMENT_TYPES = ['Full-Time', 'Part-Time', 'Contract', 'Intern'];

export default function EmployeesListPage() {
  const user = useSelector(selectCurrentUser);
  const canManage = user?.role === 'HR_ADMIN' || user?.role === 'SUPER_ADMIN';
  const isManager = user?.role === 'MANAGER';
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const list = useListParams({
    pageSize: 10,
    sort: '-createdAt',
    filters: {
      search: '',
      department: searchParams.get('department') || '',
      status: searchParams.get('status') || '',
      employmentType: '',
    },
  });
  const debouncedSearch = useDebounce(list.filters.search);
  const queryParams = { ...list.params, search: debouncedSearch || undefined };

  const employees = useApiQuery((signal) => employeeApi.list(queryParams, { signal }), [JSON.stringify(queryParams)]);
  const departments = useApiQuery((signal) => departmentApi.list({ limit: 100, status: 'active', sort: 'name' }, { signal }), []);

  const [statusTarget, setStatusTarget] = useState(null);
  const [exitDate, setExitDate] = useState('');
  const [togglingStatus, setTogglingStatus] = useState(false);
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      await exportApi.employees({
        search: debouncedSearch || undefined,
        department: list.filters.department || undefined,
        status: list.filters.status || undefined,
      });
      showToast('Employee export downloaded');
    } catch (err) {
      showToast(getApiErrorMessage(err, 'Unable to export employees.'), 'error');
    } finally {
      setExporting(false);
    }
  };

  const handleToggleStatus = async () => {
    setTogglingStatus(true);
    const nextStatus = statusTarget.status === 'active' ? 'inactive' : 'active';
    try {
      await employeeApi.updateStatus(statusTarget._id, nextStatus, nextStatus === 'inactive' ? exitDate : undefined);
      showToast(`${fullName(statusTarget)} ${nextStatus === 'active' ? 'activated' : 'deactivated'}`);
      setStatusTarget(null);
      employees.refetch();
    } catch (err) {
      showToast(getApiErrorMessage(err, 'Unable to update status.'), 'error');
    } finally {
      setTogglingStatus(false);
    }
  };

  const columns = [
    {
      key: 'name',
      header: 'Employee',
      sortKey: 'firstName',
      primary: true,
      render: (emp) => (
        <div className="flex items-center gap-3">
          <Avatar src={emp.profileImageUrl} name={fullName(emp)} />
          <div className="min-w-0">
            <Link to={`/employees/${emp._id}`} className="block truncate font-medium text-slate-900 hover:underline dark:text-white">
              {fullName(emp)}
            </Link>
            <p className="truncate text-xs text-slate-500 dark:text-slate-400">
              <span className="font-mono">{emp.employeeId}</span> · {emp.email}
            </p>
          </div>
        </div>
      ),
    },
    { key: 'department', header: 'Department', render: (emp) => emp.department?.name || '—', className: 'text-slate-600 dark:text-slate-300' },
    { key: 'designation', header: 'Designation', render: (emp) => emp.designation?.name || '—', className: 'text-slate-600 dark:text-slate-300' },
    { key: 'employmentType', header: 'Type', render: (emp) => emp.employmentType || '—', className: 'text-slate-600 dark:text-slate-300', hideOnMobile: true },
    { key: 'joiningDate', header: 'Joined', sortKey: 'joiningDate', render: (emp) => formatDate(emp.joiningDate), className: 'text-slate-600 tabular dark:text-slate-300' },
    { key: 'status', header: 'Status', sortKey: 'status', render: (emp) => <StatusBadge status={emp.status} /> },
    {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      isActions: true,
      align: 'right',
      width: 96,
      render: (emp) => (
        <div className="flex items-center justify-end gap-0.5">
          <IconButton label={`View ${fullName(emp)}`} icon={Eye} onClick={() => navigate(`/employees/${emp._id}`)} />
          {canManage && (
            <Dropdown
              trigger={({ ref, toggle, ...aria }) => <IconButton ref={ref} label="More actions" icon={MoreHorizontal} onClick={toggle} {...aria} />}
              items={[
                { label: 'Edit details', icon: Pencil, onSelect: () => navigate(`/employees/${emp._id}/edit`) },
                { type: 'separator' },
                {
                  label: emp.status === 'active' ? 'Deactivate' : 'Activate',
                  icon: Power,
                  tone: emp.status === 'active' ? 'danger' : undefined,
                  disabled: emp._id === user?.employee?._id,
                  onSelect: () => {
                    setExitDate(todayInputValue());
                    setStatusTarget(emp);
                  },
                },
              ]}
            />
          )}
        </div>
      ),
    },
  ];

  const title = isManager ? 'My Team' : canManage ? 'Employees' : 'Directory';
  const description = isManager ? 'Employees reporting to you.' : canManage ? "Manage your organization's workforce." : 'Find colleagues across the organization.';

  return (
    <div>
      <PageHeader
        title={title}
        description={description}
        meta={
          employees.pagination && (
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              <span className="font-medium text-slate-700 tabular dark:text-slate-200">{employees.pagination.total}</span> {employees.pagination.total === 1 ? 'employee' : 'employees'}
              {list.hasActiveFilters || debouncedSearch ? ' match the current filters' : ''}
            </p>
          )
        }
        actions={
          canManage && (
            <>
              <Button variant="secondary" icon={Download} onClick={handleExport} loading={exporting}>
                Export
              </Button>
              <Button icon={Plus} onClick={() => navigate('/employees/new')}>
                Add employee
              </Button>
            </>
          )
        }
      />

      <Toolbar>
        <SearchInput value={list.filters.search} onChange={(v) => list.setFilter('search', v)} placeholder="Search by name, ID or email…" className="w-full sm:w-72" />
        <Select value={list.filters.department} onChange={(e) => list.setFilter('department', e.target.value)} aria-label="Filter by department" className="w-full sm:w-48">
          <option value="">All departments</option>
          {(departments.data || []).map((d) => (
            <option key={d._id} value={d._id}>
              {d.name}
            </option>
          ))}
        </Select>
        <Select value={list.filters.employmentType} onChange={(e) => list.setFilter('employmentType', e.target.value)} aria-label="Filter by employment type" className="w-full sm:w-40">
          <option value="">All types</option>
          {EMPLOYMENT_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </Select>
        <Select value={list.filters.status} onChange={(e) => list.setFilter('status', e.target.value)} aria-label="Filter by status" className="w-full sm:w-36">
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </Select>
      </Toolbar>

      <Card>
        {employees.status === 'ready' && employees.data?.length === 0 && (list.hasActiveFilters || debouncedSearch) ? (
          <NoResults onClear={list.resetFilters} />
        ) : (
          <DataTable
            caption="Employees"
            columns={columns}
            rows={employees.data || []}
            status={employees.status}
            isFetching={employees.isFetching}
            error={employees.error}
            onRetry={employees.refetch}
            sort={list.sort}
            onSort={list.setSort}
            pagination={employees.pagination}
            onPageChange={list.setPage}
            onPageSizeChange={list.setPageSize}
            emptyIcon={Users}
            emptyTitle={isManager ? 'No direct reports yet' : 'No employees yet'}
            emptyMessage={isManager ? 'Employees whose manager is set to you will appear here.' : 'Add your first employee to get started.'}
            emptyAction={canManage ? <Button icon={Plus} onClick={() => navigate('/employees/new')}>Add employee</Button> : null}
          />
        )}
      </Card>

      <ConfirmDialog
        open={Boolean(statusTarget)}
        onClose={() => setStatusTarget(null)}
        onConfirm={handleToggleStatus}
        tone={statusTarget?.status === 'active' ? 'danger' : 'info'}
        title={statusTarget?.status === 'active' ? 'Deactivate employee' : 'Activate employee'}
        message={
          statusTarget
            ? `${fullName(statusTarget)} will ${statusTarget.status === 'active' ? 'lose access to the HRMS immediately and any open sessions will be signed out.' : 'regain access to the HRMS with their existing credentials.'}`
            : ''
        }
        confirmLabel={statusTarget?.status === 'active' ? 'Deactivate' : 'Activate'}
        loading={togglingStatus}
      >
        {statusTarget?.status === 'active' && (
          <div className="mt-3">
            <FormField label="Last working day" hint="Used to pro-rate the final month's payroll when the payroll policy enables it.">
              <Input type="date" value={exitDate} min={statusTarget.joiningDate?.slice(0, 10)} onChange={(e) => setExitDate(e.target.value)} />
            </FormField>
          </div>
        )}
      </ConfirmDialog>
    </div>
  );
}
