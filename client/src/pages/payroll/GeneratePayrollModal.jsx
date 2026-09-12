import { useEffect, useRef, useState } from 'react';
import { Modal, Button, Input, FormField, Alert, EmployeePicker } from '../../components/ui';
import { currentMonthInputValue, formatMonth } from '../../utils/format';

export default function GeneratePayrollModal({ open, onClose, onSubmit, submitting, serverError }) {
  const [month, setMonth] = useState(currentMonthInputValue());
  const [employeeId, setEmployeeId] = useState('');
  const monthRef = useRef(null);

  useEffect(() => {
    if (open) {
      setMonth(currentMonthInputValue());
      setEmployeeId('');
    }
  }, [open]);

  const isFuture = month > currentMonthInputValue();

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!month) return;
    onSubmit({ month, employeeId: employeeId || undefined });
  };

  return (
    <Modal
      open={open}
      onClose={submitting ? undefined : onClose}
      title="Generate payroll"
      description="Creates Draft payslips from each employee's salary structure."
      size="sm"
      initialFocusRef={monthRef}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" form="generate-payroll-form" loading={submitting} disabled={!month || isFuture}>
            Generate{month ? ` for ${formatMonth(month)}` : ''}
          </Button>
        </>
      }
    >
      <form id="generate-payroll-form" onSubmit={handleSubmit} className="space-y-4">
        {serverError && <Alert tone="danger">{serverError}</Alert>}
        <FormField label="Month" required>
          <Input ref={monthRef} type="month" value={month} onChange={(e) => setMonth(e.target.value)} required />
        </FormField>
        <FormField label="Employee" hint="Leave empty to run payroll for every eligible employee">
          <EmployeePicker value={employeeId} onChange={(id) => setEmployeeId(id)} emptyLabel="All eligible employees" />
        </FormField>
        {isFuture && <Alert tone="warning">Payroll can only be generated for the current or a past month.</Alert>}
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Employees without a salary structure are skipped. Existing payslips for the month are never overwritten.
        </p>
      </form>
    </Modal>
  );
}
