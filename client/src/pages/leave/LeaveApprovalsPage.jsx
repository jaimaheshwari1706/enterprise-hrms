import { useState } from 'react';
import { Check, X, Download, CheckSquare } from 'lucide-react';
import { useSelector } from 'react-redux';
import { Link, useSearchParams } from 'react-router-dom';
import { leaveApi } from '../../api/leaveApi';
import { exportApi } from '../../api/exportApi';
import { selectCurrentUser } from '../../features/auth/authSlice';
import { useToast } from '../../hooks/useToast';
import { useApiQuery } from '../../hooks/useApiQuery';
import { useListParams } from '../../hooks/useListParams';
import { Button, IconButton, Card, PageHeader, DataTable, StatusBadge, Avatar, Modal, Textarea, FormField, Toolbar, Tabs, NoResults, Alert, EmployeePicker } from '../../components/ui';
import { formatDate, fullName } from '../../utils/format';
import { getApiErrorMessage } from '../../utils/apiError';

const STATUS_TABS = [
  { value: 'Pending', label: 'Pending' },
  { value: 'Approved', label: 'Approved' },
  { value: 'Rejected', label: 'Rejected' },
  { value: 'Cancelled', label: 'Cancelled' },
  { value: '', label: 'All' },
];

export default function LeaveApprovalsPage() {
  const { showToast } = useToast();
  const user = useSelector(selectCurrentUser);
  const canExport = user?.role === 'HR_ADMIN' || user?.role === 'SUPER_ADMIN';
  const [searchParams] = useSearchParams();

  const list = useListParams({ pageSize: 10, sort: '-createdAt', filters: { status: searchParams.get('status') ?? 'Pending', employee: '' } });
  const leaves = useApiQuery((signal) => leaveApi.list(list.params, { signal }), [JSON.stringify(list.params)]);

  const [exporting, setExporting] = useState(false);
  const [decisionModal, setDecisionModal] = useState(null); // { leave, decision }
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [decisionError, setDecisionError] = useState(null);

  const handleExport = async () => {
    setExporting(true);
    try {
      await exportApi.leaves({ status: list.filters.status || undefined, employee: list.filters.employee || undefined });
      showToast('Leave export downloaded');
    } catch (err) {
      showToast(getApiErrorMessage(err, 'Unable to export leave requests.'), 'error');
    } finally {
      setExporting(false);
    }
  };

  const openDecision = (leave, decision) => {
    setComment('');
    setDecisionError(null);
    setDecisionModal({ leave, decision });
  };

  const submitDecision = async (event) => {
    event?.preventDefault();
    setSubmitting(true);
    setDecisionError(null);
    try {
      if (decisionModal.decision === 'Approved') {
        await leaveApi.approve(decisionModal.leave._id, comment);
        showToast('Leave request approved');
      } else {
        await leaveApi.reject(decisionModal.leave._id, comment);
        showToast('Leave request rejected');
      }
      setDecisionModal(null);
      leaves.refetch();
    } catch (err) {
      setDecisionError(getApiErrorMessage(err, 'Unable to record the decision.'));
    } finally {
      setSubmitting(false);
    }
  };

  const columns = [
    {
      key: 'employee',
      header: 'Employee',
      primary: true,
      render: (leave) => (
        <Link to={`/employees/${leave.employee?._id}`} className="flex items-center gap-3 hover:underline">
          <Avatar src={leave.employee?.profileImageUrl} name={fullName(leave.employee)} size={30} />
          <div className="min-w-0">
            <p className="truncate font-medium text-slate-900 dark:text-white">{fullName(leave.employee) || 'Unknown'}</p>
            <p className="truncate font-mono text-xs text-slate-500 dark:text-slate-400">{leave.employee?.employeeId}</p>
          </div>
        </Link>
      ),
    },
    {
      key: 'type',
      header: 'Type & reason',
      render: (leave) => (
        <div className="min-w-0">
          <p className="text-slate-800 dark:text-slate-100">{leave.leaveType?.name}</p>
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
    { key: 'requested', header: 'Requested', sortKey: 'createdAt', defaultDesc: true, render: (leave) => formatDate(leave.createdAt), className: 'text-slate-500 tabular dark:text-slate-400', hideOnMobile: true },
    {
      key: 'status',
      header: 'Status',
      sortKey: 'status',
      render: (leave) => (
        <div>
          <StatusBadge status={leave.status} />
          {leave.approver && leave.status !== 'Pending' && <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">by {fullName(leave.approver)}</p>}
        </div>
      ),
    },
    {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      isActions: true,
      align: 'right',
      width: 96,
      render: (leave) =>
        leave.status === 'Pending' ? (
          <div className="flex items-center justify-end gap-0.5">
            <IconButton label={`Approve request from ${fullName(leave.employee)}`} icon={Check} tone="success" onClick={() => openDecision(leave, 'Approved')} />
            <IconButton label={`Reject request from ${fullName(leave.employee)}`} icon={X} tone="danger" onClick={() => openDecision(leave, 'Rejected')} />
          </div>
        ) : null,
    },
  ];

  const isApprove = decisionModal?.decision === 'Approved';

  return (
    <div>
      <PageHeader
        title="Leave Approvals"
        description={user?.role === 'MANAGER' ? 'Review requests from your direct reports.' : 'Review leave requests across the organization.'}
        actions={
          canExport && (
            <Button variant="secondary" icon={Download} onClick={handleExport} loading={exporting}>
              Export
            </Button>
          )
        }
      />

      <Tabs tabs={STATUS_TABS} value={list.filters.status} onChange={(v) => list.setFilter('status', v)} className="mb-4" />

      <Toolbar>
        <EmployeePicker value={list.filters.employee} onChange={(id) => list.setFilter('employee', id)} emptyLabel="All employees" aria-label="Filter by employee" className="w-full sm:w-72" />
      </Toolbar>

      <Card>
        {leaves.status === 'ready' && leaves.data?.length === 0 && list.filters.employee ? (
          <NoResults onClear={() => list.setFilter('employee', '')} />
        ) : (
          <DataTable
            caption="Leave requests"
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
            emptyIcon={CheckSquare}
            emptyTitle={list.filters.status === 'Pending' ? 'Nothing to review' : 'No leave requests'}
            emptyMessage={list.filters.status === 'Pending' ? 'All requests have been actioned. New ones will appear here.' : 'No requests match this status.'}
          />
        )}
      </Card>

      <Modal
        open={Boolean(decisionModal)}
        onClose={submitting ? undefined : () => setDecisionModal(null)}
        title={isApprove ? 'Approve leave request' : 'Reject leave request'}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDecisionModal(null)} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" form="decision-form" variant={isApprove ? 'success' : 'danger'} loading={submitting} icon={isApprove ? Check : X}>
              {isApprove ? 'Approve' : 'Reject'}
            </Button>
          </>
        }
      >
        <form id="decision-form" onSubmit={submitDecision} className="space-y-4">
          {decisionError && <Alert tone="danger">{decisionError}</Alert>}
          {decisionModal && (
            <dl className="grid grid-cols-3 gap-y-1.5 rounded-lg bg-slate-50 p-3 text-sm dark:bg-slate-800/60">
              <dt className="text-slate-500 dark:text-slate-400">Employee</dt>
              <dd className="col-span-2 font-medium text-slate-800 dark:text-slate-100">{fullName(decisionModal.leave.employee)}</dd>
              <dt className="text-slate-500 dark:text-slate-400">Type</dt>
              <dd className="col-span-2 text-slate-800 dark:text-slate-100">{decisionModal.leave.leaveType?.name}</dd>
              <dt className="text-slate-500 dark:text-slate-400">Dates</dt>
              <dd className="col-span-2 text-slate-800 tabular dark:text-slate-100">
                {formatDate(decisionModal.leave.startDate)} – {formatDate(decisionModal.leave.endDate)} · {decisionModal.leave.days} day{decisionModal.leave.days === 1 ? '' : 's'}
              </dd>
              <dt className="text-slate-500 dark:text-slate-400">Reason</dt>
              <dd className="col-span-2 text-slate-800 dark:text-slate-100">{decisionModal.leave.reason}</dd>
            </dl>
          )}
          <FormField label="Note for the employee" hint="Optional — included in their notification">
            <Textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={3} maxLength={500} placeholder={isApprove ? 'e.g. Enjoy your time off' : 'e.g. Please pick dates after the release'} />
          </FormField>
        </form>
      </Modal>
    </div>
  );
}
