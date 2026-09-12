import { useState } from 'react';
import { useSelector } from 'react-redux';
import { Plus, XCircle, CalendarDays } from 'lucide-react';
import { leaveApi } from '../../api/leaveApi';
import { selectCurrentUser } from '../../features/auth/authSlice';
import { useToast } from '../../hooks/useToast';
import { useApiQuery } from '../../hooks/useApiQuery';
import { useListParams } from '../../hooks/useListParams';
import { Button, IconButton, Card, CardHeader, PageHeader, DataTable, StatusBadge, ConfirmDialog, Select, Toolbar, Alert, ProgressBar, Skeleton, NoResults, Tooltip } from '../../components/ui';
import { formatDate } from '../../utils/format';
import { getApiErrorMessage } from '../../utils/apiError';
import LeaveFormModal from './LeaveFormModal';

export default function MyLeavesPage() {
  const user = useSelector(selectCurrentUser);
  const hasProfile = Boolean(user?.employee);
  const { showToast } = useToast();

  const leaveTypes = useApiQuery((signal) => leaveApi.leaveTypes({ signal }), [], { enabled: hasProfile });
  const balance = useApiQuery((signal) => leaveApi.myBalance({ signal }), [], { enabled: hasProfile });
  const list = useListParams({ pageSize: 10, sort: '-createdAt', filters: { status: '' } });
  const leaves = useApiQuery((signal) => leaveApi.myLeaves(list.params, { signal }), [JSON.stringify(list.params)], { enabled: hasProfile });

  const [formOpen, setFormOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelling, setCancelling] = useState(false);

  const handleApply = async (values) => {
    setSubmitting(true);
    setFormError(null);
    try {
      await leaveApi.apply(values);
      showToast({ title: 'Leave request submitted', message: 'Your manager has been notified.' });
      setFormOpen(false);
      leaves.refetch();
      balance.refetch();
    } catch (err) {
      setFormError(getApiErrorMessage(err, 'Unable to submit the request.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async () => {
    setCancelling(true);
    try {
      await leaveApi.cancel(cancelTarget._id);
      showToast('Leave request cancelled');
      setCancelTarget(null);
      leaves.refetch();
      balance.refetch();
    } catch (err) {
      showToast(getApiErrorMessage(err, 'Unable to cancel the request.'), 'error');
    } finally {
      setCancelling(false);
    }
  };

  const columns = [
    {
      key: 'type',
      header: 'Leave type',
      primary: true,
      render: (leave) => (
        <div>
          <p className="font-medium text-slate-900 dark:text-white">{leave.leaveType?.name || '—'}</p>
          <p className="max-w-xs truncate text-xs text-slate-500 dark:text-slate-400" title={leave.reason}>
            {leave.reason}
          </p>
        </div>
      ),
    },
    {
      key: 'dates',
      header: 'Dates',
      sortKey: 'startDate',
      render: (leave) => (
        <span className="tabular">
          {formatDate(leave.startDate)} – {formatDate(leave.endDate)}
        </span>
      ),
      className: 'text-slate-600 dark:text-slate-300',
    },
    { key: 'days', header: 'Days', sortKey: 'days', align: 'right', render: (leave) => leave.days, className: 'text-slate-600 dark:text-slate-300' },
    { key: 'status', header: 'Status', sortKey: 'status', render: (leave) => <StatusBadge status={leave.status} /> },
    {
      key: 'comment',
      header: 'Approver note',
      render: (leave) => (leave.approverComment ? <span className="line-clamp-2 max-w-xs text-xs">{leave.approverComment}</span> : <span className="text-slate-500 dark:text-slate-400">—</span>),
      className: 'text-slate-600 dark:text-slate-300',
      hideOnMobile: false,
    },
    { key: 'requested', header: 'Requested', sortKey: 'createdAt', defaultDesc: true, render: (leave) => formatDate(leave.createdAt), className: 'text-slate-500 tabular dark:text-slate-400', hideOnMobile: true },
    {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      isActions: true,
      align: 'right',
      width: 56,
      render: (leave) =>
        leave.status === 'Pending' ? (
          <IconButton label="Cancel request" icon={XCircle} tone="danger" onClick={() => setCancelTarget(leave)} />
        ) : null,
    },
  ];

  if (!hasProfile) {
    return (
      <div>
        <PageHeader title="My Leave" description="Apply for leave and track your requests." />
        <Alert tone="info" title="No employee profile linked">
          Leave requests are filed against an employee record. Ask HR to link one to this account.
        </Alert>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="My Leave"
        description="Apply for leave and track your requests."
        actions={
          <Button icon={Plus} onClick={() => { setFormError(null); setFormOpen(true); }} disabled={!leaveTypes.data?.length}>
            Apply for leave
          </Button>
        }
      />

      <Card className="mb-6">
        <CardHeader title="Balance this year" description="Remaining days per leave type; pending requests are reserved until decided" />
        {balance.status === 'loading' ? (
          <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-6 w-16" />
                <Skeleton className="h-1.5 w-full" />
              </div>
            ))}
          </div>
        ) : balance.status === 'error' ? (
          <p className="p-5 text-sm text-slate-500">{balance.error}</p>
        ) : (balance.data || []).length === 0 ? (
          <p className="p-5 text-sm text-slate-500 dark:text-slate-400">No leave types have been configured yet.</p>
        ) : (
          <div className="grid grid-cols-1 gap-x-8 gap-y-4 p-5 sm:grid-cols-2 lg:grid-cols-3">
            {balance.data.map((lb) => {
              const consumed = lb.used + lb.pending;
              return (
                <div key={lb.leaveTypeId}>
                  <div className="flex items-baseline justify-between">
                    <p className="text-sm text-slate-600 dark:text-slate-300">{lb.leaveType}</p>
                    <Tooltip text={`${lb.used} used · ${lb.pending} pending · ${lb.allocated} allocated`}>
                      <p className="text-lg font-semibold text-slate-900 tabular dark:text-white">
                        {lb.remaining} <span className="text-xs font-normal text-slate-500 dark:text-slate-400">/ {lb.allocated}</span>
                      </p>
                    </Tooltip>
                  </div>
                  <ProgressBar value={consumed} max={lb.allocated} tone={lb.remaining === 0 ? 'danger' : consumed / lb.allocated > 0.75 ? 'warning' : 'primary'} label={`${lb.leaveType} used`} className="mt-2" />
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Toolbar>
        <Select value={list.filters.status} onChange={(e) => list.setFilter('status', e.target.value)} aria-label="Filter by status" className="w-full sm:w-44">
          <option value="">All requests</option>
          <option value="Pending">Pending</option>
          <option value="Approved">Approved</option>
          <option value="Rejected">Rejected</option>
          <option value="Cancelled">Cancelled</option>
        </Select>
      </Toolbar>

      <Card>
        {leaves.status === 'ready' && leaves.data?.length === 0 && list.hasActiveFilters ? (
          <NoResults onClear={list.resetFilters} />
        ) : (
          <DataTable
            caption="My leave requests"
            columns={columns}
            rows={leaves.data || []}
            status={leaves.status}
            isFetching={leaves.isFetching}
            error={leaves.error}
            onRetry={leaves.refetch}
            sort={list.sort}
            onSort={list.setSort}
            pagination={leaves.pagination}
            onPageChange={list.setPage}
            onPageSizeChange={list.setPageSize}
            emptyIcon={CalendarDays}
            emptyTitle="No leave requests yet"
            emptyMessage="When you apply for leave, the request and its status will appear here."
            emptyAction={leaveTypes.data?.length ? <Button icon={Plus} onClick={() => setFormOpen(true)}>Apply for leave</Button> : null}
          />
        )}
      </Card>

      <LeaveFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSubmit={handleApply}
        leaveTypes={leaveTypes.data || []}
        balance={balance.data || []}
        submitting={submitting}
        serverError={formError}
      />

      <ConfirmDialog
        open={Boolean(cancelTarget)}
        onClose={() => setCancelTarget(null)}
        onConfirm={handleCancel}
        title="Cancel leave request"
        message={cancelTarget ? `Cancel your ${cancelTarget.leaveType?.name} request for ${formatDate(cancelTarget.startDate)} – ${formatDate(cancelTarget.endDate)}? The reserved days return to your balance.` : ''}
        confirmLabel="Cancel request"
        cancelLabel="Keep request"
        loading={cancelling}
      />
    </div>
  );
}
