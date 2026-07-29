import { useEffect, useState } from 'react';
import Modal from '../../components/Modal';
import Button from '../../components/Button';

const inputClass =
  'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white';

function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export default function GeneratePayrollModal({ open, onClose, onSubmit, employees, submitting }) {
  const [month, setMonth] = useState(currentMonth());
  const [employeeId, setEmployeeId] = useState('');

  useEffect(() => {
    if (open) {
      setMonth(currentMonth());
      setEmployeeId('');
    }
  }, [open]);

  const handleSubmit = () => onSubmit({ month, employeeId: employeeId || undefined });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Generate Payroll"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting || !month}>
            {submitting ? 'Generating…' : 'Generate'}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">Month</label>
          <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">
            Employee (optional)
          </label>
          <select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} className={inputClass}>
            <option value="">All active employees</option>
            {employees.map((e) => (
              <option key={e._id} value={e._id}>{e.firstName} {e.lastName} ({e.employeeId})</option>
            ))}
          </select>
        </div>
        <p className="text-xs text-slate-400">
          Employees without a configured salary structure will be skipped. Records already generated for this
          month won&apos;t be duplicated.
        </p>
      </div>
    </Modal>
  );
}
