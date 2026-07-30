import { useEffect, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { ArrowLeft, Pencil, Upload } from 'lucide-react';
import { employeeApi } from '../../api/employeeApi';
import { payrollApi } from '../../api/payrollApi';
import { attendanceApi } from '../../api/attendanceApi';
import { leaveApi } from '../../api/leaveApi';
import { selectCurrentUser } from '../../features/auth/authSlice';
import { useToast } from '../../components/ToastProvider';
import Avatar from '../../components/Avatar';
import StatusBadge from '../../components/StatusBadge';
import Button from '../../components/Button';
import { Loading, ErrorState } from '../../components/StateViews';

const TABS = ['Overview', 'Personal', 'Job', 'Attendance', 'Leave', 'Payroll'];

function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function InfoRow({ label, value }) {
  return (
    <div className="flex justify-between border-b border-slate-100 py-2.5 text-sm last:border-0 dark:border-slate-800">
      <span className="text-slate-500 dark:text-slate-400">{label}</span>
      <span className="font-medium text-slate-800 dark:text-slate-100">{value || '—'}</span>
    </div>
  );
}

function ComingSoon({ phase }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
      This tab will be built in {phase}.
    </div>
  );
}

export default function EmployeeDetailPage() {
  const { id } = useParams();
  const user = useSelector(selectCurrentUser);
  const canManage = user?.role === 'HR_ADMIN' || user?.role === 'SUPER_ADMIN';
  const { showToast } = useToast();
  const fileInputRef = useRef(null);

  const [employee, setEmployee] = useState(null);
  const [status, setStatus] = useState('loading');
  const [activeTab, setActiveTab] = useState('Overview');
  const [uploading, setUploading] = useState(false);
  const [payrollRecords, setPayrollRecords] = useState(null);
  const [salary, setSalary] = useState(null);
  const [attendanceRecords, setAttendanceRecords] = useState(null);
  const [leaveRecords, setLeaveRecords] = useState(null);

  const fetchEmployee = () => {
    setStatus('loading');
    employeeApi
      .get(id)
      .then(({ data }) => {
        setEmployee(data.data);
        setStatus('ready');
      })
      .catch(() => setStatus('error'));
  };

  useEffect(fetchEmployee, [id]);

  const isSelf = employee && user?.employee?.id === employee._id;
  const canEditPhoto = canManage || isSelf;
  const canViewPayroll = canManage || isSelf;

  useEffect(() => {
    if (activeTab !== 'Payroll' || !employee || !canViewPayroll || payrollRecords !== null) return;
    payrollApi.getSalary(employee._id).then(({ data }) => setSalary(data.data)).catch(() => setSalary(null));
    const request = canManage
      ? payrollApi.list({ employee: employee._id, limit: 12 })
      : payrollApi.myPayroll({ limit: 12 });
    request.then(({ data }) => setPayrollRecords(data.data)).catch(() => setPayrollRecords([]));
  }, [activeTab, employee, canViewPayroll, canManage, payrollRecords]);

  useEffect(() => {
    if (activeTab !== 'Attendance' || !employee || attendanceRecords !== null) return;
    const request = canManage || (employee && user?.role === 'MANAGER')
      ? attendanceApi.list({ employee: employee._id, limit: 10 })
      : attendanceApi.myHistory({ limit: 10 });
    request.then(({ data }) => setAttendanceRecords(data.data)).catch(() => setAttendanceRecords([]));
  }, [activeTab, employee, canManage, user, attendanceRecords]);

  useEffect(() => {
    if (activeTab !== 'Leave' || !employee || leaveRecords !== null) return;
    const request = canManage || (employee && user?.role === 'MANAGER')
      ? leaveApi.list({ employee: employee._id, limit: 10 })
      : leaveApi.myLeaves({ limit: 10 });
    request.then(({ data }) => setLeaveRecords(data.data)).catch(() => setLeaveRecords([]));
  }, [activeTab, employee, canManage, user, leaveRecords]);

  const handlePhotoChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { data } = await employeeApi.uploadProfileImage(id, file);
      setEmployee(data.data);
      showToast('Profile photo updated');
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to upload photo', 'error');
    } finally {
      setUploading(false);
    }
  };

  if (status === 'loading') return <Loading label="Loading employee…" />;
  if (status === 'error' || !employee) return <ErrorState message="Failed to load this employee." />;

  return (
    <div>
      <Link to="/employees" className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200">
        <ArrowLeft size={15} /> Back to employees
      </Link>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-4">
          <div className="relative">
            <Avatar src={employee.profileImageUrl} name={`${employee.firstName} ${employee.lastName}`} size={64} />
            {canEditPhoto && (
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="absolute -bottom-1 -right-1 rounded-full bg-indigo-600 p-1 text-white shadow"
                title="Change photo"
              >
                <Upload size={12} />
              </button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handlePhotoChange}
            />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-slate-900 dark:text-white">
              {employee.firstName} {employee.lastName}
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {employee.designation?.name || '—'} · {employee.department?.name || '—'}
            </p>
            <div className="mt-1 flex items-center gap-2">
              <StatusBadge status={employee.status} />
              <span className="text-xs text-slate-400">{employee.employeeId}</span>
            </div>
          </div>
        </div>
        {canManage && (
          <Link to={`/employees/${employee._id}/edit`}>
            <Button variant="secondary">
              <Pencil size={15} /> Edit
            </Button>
          </Link>
        )}
      </div>

      <div className="mb-4 flex gap-1 overflow-x-auto border-b border-slate-200 dark:border-slate-800">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
              activeTab === tab
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'Overview' && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <h3 className="mb-2 text-sm font-semibold text-slate-900 dark:text-white">Contact</h3>
            <InfoRow label="Email" value={employee.email} />
            <InfoRow label="Phone" value={employee.phone} />
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <h3 className="mb-2 text-sm font-semibold text-slate-900 dark:text-white">Employment</h3>
            <InfoRow label="Joining Date" value={formatDate(employee.joiningDate)} />
            <InfoRow label="Employment Type" value={employee.employmentType} />
            <InfoRow label="Manager" value={employee.manager ? `${employee.manager.firstName} ${employee.manager.lastName}` : '—'} />
          </div>
        </div>
      )}

      {activeTab === 'Personal' && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <InfoRow label="Date of Birth" value={formatDate(employee.dob)} />
          <InfoRow label="Gender" value={employee.gender} />
          <InfoRow
            label="Address"
            value={
              [employee.address?.line1, employee.address?.city, employee.address?.state, employee.address?.country, employee.address?.zip]
                .filter(Boolean)
                .join(', ') || '—'
            }
          />
        </div>
      )}

      {activeTab === 'Job' && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <InfoRow label="Employee ID" value={employee.employeeId} />
          <InfoRow label="Department" value={employee.department?.name} />
          <InfoRow label="Designation" value={employee.designation?.name} />
          <InfoRow label="Employment Type" value={employee.employmentType} />
          <InfoRow label="Status" value={employee.status} />
        </div>
      )}

      {activeTab === 'Attendance' && (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          {attendanceRecords === null && <Loading label="Loading attendance…" />}
          {attendanceRecords?.length === 0 && (
            <EmptyState title="No attendance records yet" message="Records will appear here once check-ins begin." />
          )}
          {attendanceRecords?.length > 0 && (
            <div className="overflow-x-auto"><table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 text-xs uppercase text-slate-500 dark:border-slate-800 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Hours</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {attendanceRecords.map((rec) => (
                  <tr key={rec._id} className="text-slate-700 dark:text-slate-200">
                    <td className="px-4 py-3">{formatDate(rec.date)}</td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{rec.workingHours || '—'}</td>
                    <td className="px-4 py-3"><StatusBadge status={rec.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          )}
        </div>
      )}

      {activeTab === 'Leave' && (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          {leaveRecords === null && <Loading label="Loading leave requests…" />}
          {leaveRecords?.length === 0 && (
            <EmptyState title="No leave requests yet" message="Leave requests will appear here once submitted." />
          )}
          {leaveRecords?.length > 0 && (
            <div className="overflow-x-auto"><table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 text-xs uppercase text-slate-500 dark:border-slate-800 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3 font-medium">Type</th>
                  <th className="px-4 py-3 font-medium">Dates</th>
                  <th className="px-4 py-3 font-medium">Days</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {leaveRecords.map((rec) => (
                  <tr key={rec._id} className="text-slate-700 dark:text-slate-200">
                    <td className="px-4 py-3">{rec.leaveType?.name}</td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400">
                      {formatDate(rec.startDate)} – {formatDate(rec.endDate)}
                    </td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{rec.days}</td>
                    <td className="px-4 py-3"><StatusBadge status={rec.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          )}
        </div>
      )}
      {activeTab === 'Payroll' && (
        canViewPayroll ? (
          <div className="space-y-4">
            {salary && (
              <div className="grid grid-cols-2 gap-4 rounded-xl border border-slate-200 bg-white p-5 sm:grid-cols-4 dark:border-slate-800 dark:bg-slate-900">
                <InfoRow label="Basic" value={salary.basic?.toLocaleString()} />
                <InfoRow label="HRA" value={salary.hra?.toLocaleString()} />
                <InfoRow label="Allowances" value={salary.allowances?.toLocaleString()} />
                <InfoRow label="Deductions" value={salary.deductions?.toLocaleString()} />
              </div>
            )}
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
              {payrollRecords === null && <Loading label="Loading payroll…" />}
              {payrollRecords?.length === 0 && (
                <EmptyState title="No payroll records yet" message="Payroll history will appear here once generated." />
              )}
              {payrollRecords?.length > 0 && (
                <div className="overflow-x-auto"><table className="w-full text-left text-sm">
                  <thead className="border-b border-slate-200 text-xs uppercase text-slate-500 dark:border-slate-800 dark:text-slate-400">
                    <tr>
                      <th className="px-4 py-3 font-medium">Month</th>
                      <th className="px-4 py-3 font-medium">Net Salary</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {payrollRecords.map((rec) => (
                      <tr key={rec._id} className="text-slate-700 dark:text-slate-200">
                        <td className="px-4 py-3">{rec.month}</td>
                        <td className="px-4 py-3 font-medium">{rec.netSalary?.toLocaleString()}</td>
                        <td className="px-4 py-3"><StatusBadge status={rec.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table></div>
              )}
            </div>
          </div>
        ) : (
          <EmptyState title="Not available" message="You don't have permission to view this section." />
        )
      )}
    </div>
  );
}
