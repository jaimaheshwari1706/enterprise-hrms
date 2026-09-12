import { useRef, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { Pencil, Upload, Mail, Phone, Building2, Briefcase, CalendarDays, UserCircle, Clock, Wallet, Lock } from 'lucide-react';
import { employeeApi } from '../../api/employeeApi';
import { payrollApi } from '../../api/payrollApi';
import { attendanceApi } from '../../api/attendanceApi';
import { leaveApi } from '../../api/leaveApi';
import { selectCurrentUser, updateCurrentEmployee } from '../../features/auth/authSlice';
import { useToast } from '../../hooks/useToast';
import { useApiQuery } from '../../hooks/useApiQuery';
import {
  Avatar, StatusBadge, Button, Card, CardHeader, PageHeader, Tabs, DataTable, Skeleton, ErrorState, EmptyState, Badge,
} from '../../components/ui';
import { formatDate, formatTime, formatHours, formatCurrency, formatMonth, fullName } from '../../utils/format';
import { getApiErrorMessage } from '../../utils/apiError';

function InfoRow({ label, value, icon: Icon }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-slate-100 py-2.5 text-sm last:border-0 dark:border-slate-800">
      <dt className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
        {Icon && <Icon size={14} aria-hidden="true" className="shrink-0 opacity-70" />}
        {label}
      </dt>
      <dd className="text-right font-medium text-slate-800 dark:text-slate-100">{value || '—'}</dd>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div role="status" aria-label="Loading employee">
      <Skeleton className="mb-4 h-3 w-40" />
      <div className="ui-card mb-6 flex items-center gap-4 p-5">
        <Skeleton className="h-16 w-16 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-3 w-64" />
          <Skeleton className="h-3 w-24" />
        </div>
      </div>
      <Skeleton className="mb-4 h-9 w-full" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="ui-card space-y-3 p-5">
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-3/4" />
        </div>
        <div className="ui-card space-y-3 p-5">
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-2/3" />
        </div>
      </div>
    </div>
  );
}

export default function EmployeeDetailPage() {
  const { id } = useParams();
  const user = useSelector(selectCurrentUser);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const canManage = user?.role === 'HR_ADMIN' || user?.role === 'SUPER_ADMIN';
  const isManagerRole = user?.role === 'MANAGER';
  const { showToast } = useToast();
  const fileInputRef = useRef(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [uploading, setUploading] = useState(false);

  const employee = useApiQuery((signal) => employeeApi.get(id, { signal }), [id]);
  const emp = employee.data;

  const isSelf = Boolean(emp && (user?.employee?._id === emp._id || user?.employee?.id === emp._id));
  const isDirectManager = Boolean(emp && isManagerRole && (emp.manager?._id || emp.manager) === user?.employee?._id);
  // The API returns the directory view (no personal fields) when the viewer
  // has no right to them — mirror that in the tabs we show.
  const fullRecord = Boolean(emp && (emp.address !== undefined || emp.dob !== undefined || emp.phone !== undefined));
  const canEditPhoto = canManage || isSelf;
  const canViewPayroll = canManage || isSelf;
  const canViewAttendance = canManage || isSelf || isDirectManager;

  const attendance = useApiQuery(
    (signal) => (isSelf && !canManage && !isDirectManager ? attendanceApi.myHistory({ limit: 10 }, { signal }) : attendanceApi.list({ employee: id, limit: 10 }, { signal })),
    [id, isSelf, canManage, isDirectManager],
    { enabled: activeTab === 'attendance' && canViewAttendance }
  );
  const leaves = useApiQuery(
    (signal) => (isSelf && !canManage && !isDirectManager ? leaveApi.myLeaves({ limit: 10 }, { signal }) : leaveApi.list({ employee: id, limit: 10 }, { signal })),
    [id, isSelf, canManage, isDirectManager],
    { enabled: activeTab === 'leave' && canViewAttendance }
  );
  const salary = useApiQuery((signal) => payrollApi.getSalary(id, { signal }), [id], { enabled: activeTab === 'payroll' && canViewPayroll });
  const payroll = useApiQuery(
    (signal) => (canManage ? payrollApi.list({ employee: id, limit: 12 }, { signal }) : payrollApi.myPayroll({ limit: 12 }, { signal })),
    [id, canManage],
    { enabled: activeTab === 'payroll' && canViewPayroll }
  );

  const handlePhotoChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { data } = await employeeApi.uploadProfileImage(id, file);
      employee.setData((prev) => ({ ...prev, profileImageUrl: data.data.profileImageUrl }));
      if (isSelf) dispatch(updateCurrentEmployee({ ...user.employee, profileImageUrl: data.data.profileImageUrl }));
      showToast('Profile photo updated');
    } catch (err) {
      showToast(getApiErrorMessage(err, 'Unable to upload photo.'), 'error');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  if (employee.status === 'loading') return <DetailSkeleton />;
  if (employee.status === 'error' || !emp) {
    return (
      <div>
        <PageHeader title="Employee" breadcrumb={[{ label: 'Employees', to: '/employees' }, { label: 'Not found' }]} />
        <Card>
          <ErrorState message={employee.error || 'This employee could not be loaded.'} onRetry={employee.refetch} />
        </Card>
      </div>
    );
  }

  const tabs = [
    { value: 'overview', label: 'Overview', icon: UserCircle },
    ...(canViewAttendance ? [{ value: 'attendance', label: 'Attendance', icon: Clock }, { value: 'leave', label: 'Leave', icon: CalendarDays }] : []),
    ...(canViewPayroll ? [{ value: 'payroll', label: 'Payroll', icon: Wallet }] : []),
  ];

  const attendanceColumns = [
    { key: 'date', header: 'Date', primary: true, render: (r) => <span className="font-medium text-slate-900 dark:text-white">{formatDate(r.date, { weekday: 'short' })}</span> },
    { key: 'checkIn', header: 'Check in', render: (r) => formatTime(r.checkIn), className: 'text-slate-600 tabular dark:text-slate-300' },
    { key: 'checkOut', header: 'Check out', render: (r) => formatTime(r.checkOut), className: 'text-slate-600 tabular dark:text-slate-300' },
    { key: 'workingHours', header: 'Hours', align: 'right', render: (r) => formatHours(r.workingHours), className: 'text-slate-600 dark:text-slate-300' },
    { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
  ];
  const leaveColumns = [
    { key: 'type', header: 'Type', primary: true, render: (r) => <span className="font-medium text-slate-900 dark:text-white">{r.leaveType?.name}</span> },
    { key: 'dates', header: 'Dates', render: (r) => <span className="tabular">{formatDate(r.startDate)} – {formatDate(r.endDate)}</span>, className: 'text-slate-600 dark:text-slate-300' },
    { key: 'days', header: 'Days', align: 'right', render: (r) => r.days, className: 'text-slate-600 dark:text-slate-300' },
    { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
  ];
  const payrollColumns = [
    { key: 'month', header: 'Month', primary: true, render: (r) => <span className="font-medium text-slate-900 dark:text-white">{formatMonth(r.month)}</span> },
    { key: 'grossSalary', header: 'Gross', align: 'right', render: (r) => formatCurrency(r.grossSalary), className: 'text-slate-600 dark:text-slate-300' },
    { key: 'deductions', header: 'Deductions', align: 'right', render: (r) => formatCurrency(r.deductions), className: 'text-slate-600 dark:text-slate-300', hideOnMobile: true },
    { key: 'netSalary', header: 'Net', align: 'right', render: (r) => <span className="font-semibold">{formatCurrency(r.netSalary)}</span> },
    { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
  ];

  const address = [emp.address?.line1, emp.address?.city, emp.address?.state, emp.address?.country, emp.address?.zip].filter(Boolean).join(', ');

  return (
    <div>
      <PageHeader
        title={fullName(emp)}
        breadcrumb={[{ label: 'Employees', to: '/employees' }, { label: fullName(emp) }]}
        actions={
          canManage && (
            <Button variant="secondary" icon={Pencil} onClick={() => navigate(`/employees/${emp._id}/edit`)}>
              Edit
            </Button>
          )
        }
      />

      <Card className="mb-6">
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
          <div className="relative shrink-0">
            <Avatar src={emp.profileImageUrl} name={fullName(emp)} size={72} />
            {canEditPhoto && (
              <>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  aria-label="Change profile photo"
                  className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-primary-600 text-white shadow ring-2 ring-white hover:bg-primary-700 disabled:opacity-60 dark:ring-slate-900"
                >
                  <Upload size={13} aria-hidden="true" />
                </button>
                <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handlePhotoChange} />
              </>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{fullName(emp)}</h2>
              <StatusBadge status={emp.status} />
              {isSelf && <Badge tone="primary">You</Badge>}
            </div>
            <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
              {emp.designation?.name || '—'} · {emp.department?.name || '—'}
            </p>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
              <span className="font-mono">{emp.employeeId}</span>
              <a href={`mailto:${emp.email}`} className="inline-flex items-center gap-1 hover:text-slate-800 hover:underline dark:hover:text-slate-200">
                <Mail size={12} aria-hidden="true" /> {emp.email}
              </a>
              {emp.phone && (
                <a href={`tel:${emp.phone}`} className="inline-flex items-center gap-1 hover:text-slate-800 hover:underline dark:hover:text-slate-200">
                  <Phone size={12} aria-hidden="true" /> {emp.phone}
                </a>
              )}
              {emp.joiningDate && (
                <span className="inline-flex items-center gap-1">
                  <CalendarDays size={12} aria-hidden="true" /> Joined {formatDate(emp.joiningDate)}
                </span>
              )}
            </div>
          </div>
        </div>
      </Card>

      <Tabs tabs={tabs} value={activeTab} onChange={setActiveTab} className="mb-5" />

      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader title="Employment" />
            <dl className="px-5 py-1">
              <InfoRow icon={Building2} label="Department" value={emp.department?.name} />
              <InfoRow icon={Briefcase} label="Designation" value={emp.designation?.name} />
              <InfoRow icon={UserCircle} label="Employment type" value={emp.employmentType} />
              <InfoRow icon={CalendarDays} label="Joining date" value={formatDate(emp.joiningDate)} />
              {emp.exitDate && <InfoRow icon={CalendarDays} label="Last working day" value={formatDate(emp.exitDate)} />}
              {fullRecord && (
                <InfoRow
                  icon={UserCircle}
                  label="Reports to"
                  value={emp.manager ? <Link to={`/employees/${emp.manager._id}`} className="hover:underline">{fullName(emp.manager)}</Link> : 'No manager'}
                />
              )}
            </dl>
          </Card>
          <Card>
            <CardHeader title="Personal" description={fullRecord ? undefined : 'Visible to HR, their manager and the employee'} />
            {fullRecord ? (
              <dl className="px-5 py-1">
                <InfoRow icon={Mail} label="Email" value={emp.email} />
                <InfoRow icon={Phone} label="Phone" value={emp.phone} />
                <InfoRow icon={CalendarDays} label="Date of birth" value={formatDate(emp.dob)} />
                <InfoRow icon={UserCircle} label="Gender" value={emp.gender} />
                <InfoRow icon={Building2} label="Address" value={address} />
              </dl>
            ) : (
              <EmptyState compact icon={Lock} title="Personal details are private" message="Contact details beyond the work email are only shown to HR and the employee's manager." />
            )}
          </Card>
        </div>
      )}

      {activeTab === 'attendance' && (
        <Card>
          <CardHeader title="Recent attendance" description="Last 10 records" actions={isSelf && <Link to="/attendance" className="text-xs font-medium text-primary-600 hover:underline dark:text-primary-400">Full history</Link>} />
          <DataTable columns={attendanceColumns} rows={attendance.data || []} status={attendance.status} isFetching={attendance.isFetching} error={attendance.error} onRetry={attendance.refetch} emptyIcon={Clock} emptyTitle="No attendance records yet" emptyMessage="Records will appear here once check-ins begin." dense />
        </Card>
      )}

      {activeTab === 'leave' && (
        <Card>
          <CardHeader title="Recent leave requests" description="Last 10 requests" actions={isSelf && <Link to="/leaves" className="text-xs font-medium text-primary-600 hover:underline dark:text-primary-400">Manage leave</Link>} />
          <DataTable columns={leaveColumns} rows={leaves.data || []} status={leaves.status} isFetching={leaves.isFetching} error={leaves.error} onRetry={leaves.refetch} emptyIcon={CalendarDays} emptyTitle="No leave requests yet" emptyMessage="Leave requests will appear here once submitted." dense />
        </Card>
      )}

      {activeTab === 'payroll' && (
        <div className="space-y-4">
          <Card>
            <CardHeader title="Salary structure" description={salary.data?.effectiveFrom ? `Effective since ${formatDate(salary.data.effectiveFrom)}` : undefined} actions={canManage && <Link to="/payroll/manage" className="text-xs font-medium text-primary-600 hover:underline dark:text-primary-400">Configure</Link>} />
            {salary.status === 'loading' ? (
              <div className="grid grid-cols-2 gap-4 p-5 sm:grid-cols-4">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="space-y-2">
                    <Skeleton className="h-3 w-16" />
                    <Skeleton className="h-5 w-24" />
                  </div>
                ))}
              </div>
            ) : salary.data ? (
              <dl className="grid grid-cols-2 gap-4 p-5 sm:grid-cols-4">
                {[
                  ['Basic', salary.data.basic],
                  ['HRA', salary.data.hra],
                  ['Allowances', salary.data.allowances],
                  ['Deductions', salary.data.deductions],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</dt>
                    <dd className="mt-1 text-base font-semibold text-slate-900 tabular dark:text-white">{formatCurrency(value)}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <EmptyState compact icon={Wallet} title="No salary structure yet" message={canManage ? 'Configure one from Payroll → Salary structures.' : 'HR has not configured a salary structure yet.'} />
            )}
          </Card>
          <Card>
            <CardHeader title="Payslips" description={canManage ? 'Last 12 months including drafts' : 'Processed and paid payslips'} />
            <DataTable columns={payrollColumns} rows={payroll.data || []} status={payroll.status} isFetching={payroll.isFetching} error={payroll.error} onRetry={payroll.refetch} emptyIcon={Wallet} emptyTitle="No payslips yet" emptyMessage="Payroll history will appear here once generated." dense />
          </Card>
        </div>
      )}
    </div>
  );
}
