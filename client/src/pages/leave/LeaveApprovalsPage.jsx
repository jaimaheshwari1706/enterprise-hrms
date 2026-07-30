import { useCallback, useEffect, useState } from 'react';
import { Check, X, Download } from 'lucide-react';
import { useSelector } from 'react-redux';
import { leaveApi } from '../../api/leaveApi';
import { exportApi } from '../../api/exportApi';
import { selectCurrentUser } from '../../features/auth/authSlice';
import { useToast } from '../../components/ToastProvider';
import Avatar from '../../components/Avatar';
import StatusBadge from '../../components/StatusBadge';
import Pagination from '../../components/Pagination';
import Modal from '../../components/Modal';
import Button from '../../components/Button';
import { EmptyState, ErrorState, Loading } from '../../components/StateViews';

function formatDate(value) {
  return new Date(value).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

const inputClass =
  'rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white';

export default function LeaveApprovalsPage() {
  const { showToast } = useToast();
  const user = useSelector(selectCurrentUser);
  const canExport = user?.role === 'HR_ADMIN' || user?.role === 'SUPER_ADMIN';

  const [statusFilter, setStatusFilter] = useState('Pending');
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      await exportApi.leaves({ status: statusFilter || undefined });
    } catch {
      showToast('Failed to export leave requests', 'error');
    } finally {
      setExporting(false);
    }
  };

  const [leaves, setLeaves] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [status, setStatus] = useState('loading');

  const [decisionModal, setDecisionModal] = useState(null); // { leave, decision }
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchLeaves = useCallback(async () => {
    setStatus('loading');
    try {
      const { data } = await leaveApi.list({ page, limit: 10, status: statusFilter || undefined });
      setLeaves(data.data);
      setPagination(data.pagination);
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  }, [page, statusFilter]);

  useEffect(() => {
    fetchLeaves();
  }, [fetchLeaves]);

  useEffect(() => {
    setPage(1);
  }, [statusFilter]);

  const openDecision = (leave, decision) => {
    setComment('');
    setDecisionModal({ leave, decision });
  };

  const submitDecision = async () => {
    setSubmitting(true);
    try {
      if (decisionModal.decision === 'Approved') {
        await leaveApi.approve(decisionModal.leave._id, comment);
        showToast('Leave request approved');
      } else {
        await leaveApi.reject(decisionModal.leave._id, comment);
        showToast('Leave request rejected');
      }
      setDecisionModal(null);
      fetchLeaves();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to record decision', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <h1 className="mb-1 text-xl font-semibold text-slate-900 dark:text-white">Leave Approvals</h1>
      <p className="mb-6 text-sm text-slate-500 dark:text-slate-400">Review and act on leave requests from your team.</p>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={inputClass}>
          <option value="Pending">Pending</option>
          <option value="Approved">Approved</option>
          <option value="Rejected">Rejected</option>
          <option value="Cancelled">Cancelled</option>
          <option value="">All</option>
        </select>
        {canExport && (
          <Button variant="secondary" onClick={handleExport} disabled={exporting}>
            <Download size={16} /> {exporting ? 'Exporting…' : 'Export'}
          </Button>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        {status === 'loading' && <Loading label="Loading leave requests…" />}
        {status === 'error' && <ErrorState message="Failed to load leave requests." />}
        {status === 'ready' && leaves.length === 0 && (
          <EmptyState title="No leave requests found" message="There's nothing to review right now." />
        )}
        {status === 'ready' && leaves.length > 0 && (
          <>
            <div className="overflow-x-auto"><table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 text-xs uppercase text-slate-500 dark:border-slate-800 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3 font-medium">Employee</th>
                  <th className="px-4 py-3 font-medium">Type</th>
                  <th className="px-4 py-3 font-medium">Dates</th>
                  <th className="px-4 py-3 font-medium">Days</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {leaves.map((leave) => (
                  <tr key={leave._id} className="text-slate-700 dark:text-slate-200">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Avatar
                          src={leave.employee?.profileImageUrl}
                          name={`${leave.employee?.firstName} ${leave.employee?.lastName}`}
                          size={28}
                        />
                        <span>{leave.employee?.firstName} {leave.employee?.lastName}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">{leave.leaveType?.name}</td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400">
                      {formatDate(leave.startDate)} – {formatDate(leave.endDate)}
                    </td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{leave.days}</td>
                    <td className="px-4 py-3"><StatusBadge status={leave.status} /></td>
                    <td className="px-4 py-3">
                      {leave.status === 'Pending' && (
                        <div className="flex gap-1">
                          <button
                            onClick={() => openDecision(leave, 'Approved')}
                            className="rounded-lg p-1.5 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-500/10"
                            title="Approve"
                          >
                            <Check size={16} />
                          </button>
                          <button
                            onClick={() => openDecision(leave, 'Rejected')}
                            className="rounded-lg p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10"
                            title="Reject"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table></div>
            <Pagination pagination={pagination} onPageChange={setPage} />
          </>
        )}
      </div>

      <Modal
        open={Boolean(decisionModal)}
        onClose={() => setDecisionModal(null)}
        title={decisionModal?.decision === 'Approved' ? 'Approve leave request' : 'Reject leave request'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setDecisionModal(null)} disabled={submitting}>
              Cancel
            </Button>
            <Button
              variant={decisionModal?.decision === 'Approved' ? 'primary' : 'danger'}
              onClick={submitDecision}
              disabled={submitting}
            >
              {submitting ? 'Saving…' : decisionModal?.decision === 'Approved' ? 'Approve' : 'Reject'}
            </Button>
          </>
        }
      >
        <p className="mb-3 text-sm text-slate-600 dark:text-slate-300">
          {decisionModal?.leave?.employee?.firstName} {decisionModal?.leave?.employee?.lastName} requested{' '}
          {decisionModal?.leave?.leaveType?.name} for {decisionModal?.leave?.days} day
          {decisionModal?.leave?.days > 1 ? 's' : ''}.
        </p>
        <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">
          Comment (optional)
        </label>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={3}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          placeholder="Add a note for the employee (optional)"
        />
      </Modal>
    </div>
  );
}
