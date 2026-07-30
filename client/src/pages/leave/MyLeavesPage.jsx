import { useCallback, useEffect, useState } from 'react';
import { Plus, XCircle } from 'lucide-react';
import { leaveApi } from '../../api/leaveApi';
import { useToast } from '../../components/ToastProvider';
import Button from '../../components/Button';
import Pagination from '../../components/Pagination';
import StatusBadge from '../../components/StatusBadge';
import ConfirmDialog from '../../components/ConfirmDialog';
import { EmptyState, ErrorState, Loading } from '../../components/StateViews';
import LeaveFormModal from './LeaveFormModal';

function formatDate(value) {
  return new Date(value).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function MyLeavesPage() {
  const { showToast } = useToast();

  const [leaveTypes, setLeaveTypes] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('loading');

  const [formOpen, setFormOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    leaveApi.leaveTypes().then(({ data }) => setLeaveTypes(data.data));
  }, []);

  const fetchLeaves = useCallback(async () => {
    setStatus('loading');
    try {
      const { data } = await leaveApi.myLeaves({ page, limit: 10 });
      setLeaves(data.data);
      setPagination(data.pagination);
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  }, [page]);

  useEffect(() => {
    fetchLeaves();
  }, [fetchLeaves]);

  const handleApply = async (values) => {
    setSubmitting(true);
    try {
      await leaveApi.apply(values);
      showToast('Leave request submitted');
      setFormOpen(false);
      fetchLeaves();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to submit leave request', 'error');
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
      fetchLeaves();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to cancel leave request', 'error');
    } finally {
      setCancelling(false);
    }
  };

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-white">Leave</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Apply for leave and track your requests.</p>
        </div>
        <Button onClick={() => setFormOpen(true)} disabled={leaveTypes.length === 0}>
          <Plus size={16} /> Apply for Leave
        </Button>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        {status === 'loading' && <Loading label="Loading your leave requests…" />}
        {status === 'error' && <ErrorState message="Failed to load leave requests." />}
        {status === 'ready' && leaves.length === 0 && (
          <EmptyState title="No leave requests yet" message="Apply for leave using the button above." />
        )}
        {status === 'ready' && leaves.length > 0 && (
          <>
            <div className="overflow-x-auto"><table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 text-xs uppercase text-slate-500 dark:border-slate-800 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3 font-medium">Type</th>
                  <th className="px-4 py-3 font-medium">Dates</th>
                  <th className="px-4 py-3 font-medium">Days</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Comment</th>
                  <th className="px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {leaves.map((leave) => (
                  <tr key={leave._id} className="text-slate-700 dark:text-slate-200">
                    <td className="px-4 py-3 font-medium">{leave.leaveType?.name}</td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400">
                      {formatDate(leave.startDate)} – {formatDate(leave.endDate)}
                    </td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{leave.days}</td>
                    <td className="px-4 py-3"><StatusBadge status={leave.status} /></td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{leave.approverComment || '—'}</td>
                    <td className="px-4 py-3">
                      {leave.status === 'Pending' && (
                        <button
                          onClick={() => setCancelTarget(leave)}
                          className="rounded-lg p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10"
                          title="Cancel request"
                        >
                          <XCircle size={15} />
                        </button>
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

      <LeaveFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSubmit={handleApply}
        leaveTypes={leaveTypes}
        submitting={submitting}
      />

      <ConfirmDialog
        open={Boolean(cancelTarget)}
        onClose={() => setCancelTarget(null)}
        onConfirm={handleCancel}
        title="Cancel leave request"
        message="Are you sure you want to cancel this pending leave request?"
        confirmLabel="Cancel request"
        loading={cancelling}
      />
    </div>
  );
}
