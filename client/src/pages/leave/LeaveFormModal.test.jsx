import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LeaveFormModal from './LeaveFormModal';
import { leaveApi } from '../../api/leaveApi';

vi.mock('../../api/leaveApi', () => ({
  leaveApi: { preview: vi.fn() },
}));

const leaveTypes = [
  { _id: 'casual', name: 'Casual Leave', isPaid: true },
  { _id: 'lop', name: 'Loss of Pay', isPaid: false },
];
const balance = [
  { leaveTypeId: 'casual', leaveType: 'Casual Leave', allocated: 12, used: 9, pending: 0, remaining: 3 },
  { leaveTypeId: 'lop', leaveType: 'Loss of Pay', allocated: 30, used: 0, pending: 0, remaining: 30 },
];

function previewFor(days, extra = {}) {
  return { data: { data: { days, calendarDays: days, weekendDays: 0, holidayDays: 0, holidays: [], ...extra } } };
}

async function setup(props = {}) {
  const onSubmit = vi.fn();
  const onClose = vi.fn();
  render(<LeaveFormModal open onClose={onClose} onSubmit={onSubmit} leaveTypes={leaveTypes} balance={balance} {...props} />);
  // The dialog moves focus to its first field on the next animation frame;
  // wait for that so typing isn't interrupted by the focus change.
  await waitFor(() => expect(screen.getByLabelText(/leave type/i)).toHaveFocus());
  return { onSubmit, onClose };
}

beforeEach(() => {
  leaveApi.preview.mockReset();
});

describe('LeaveFormModal', () => {
  it('validates required fields and the date order before submitting', async () => {
    const { onSubmit } = await setup();
    await userEvent.click(screen.getByRole('button', { name: /submit request/i }));
    expect(await screen.findByText(/start date is required/i)).toBeInTheDocument();
    expect(screen.getByText(/end date is required/i)).toBeInTheDocument();
    expect(screen.getByText(/provide a short reason/i)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();

    await userEvent.type(screen.getByLabelText(/start date/i), '2026-08-12');
    await userEvent.type(screen.getByLabelText(/end date/i), '2026-08-10');
    await userEvent.type(screen.getByLabelText(/reason/i), 'Family trip');
    await userEvent.click(screen.getByRole('button', { name: /submit request/i }));
    expect(await screen.findByText(/end date cannot be before start date/i)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('shows the server-computed working-day count (weekends and holidays excluded) and submits', async () => {
    leaveApi.preview.mockResolvedValue(previewFor(2, { calendarDays: 4, weekendDays: 2 }));
    const { onSubmit } = await setup();
    await userEvent.type(screen.getByLabelText(/start date/i), '2026-08-07');
    await userEvent.type(screen.getByLabelText(/end date/i), '2026-08-10');
    await userEvent.type(screen.getByLabelText(/reason/i), 'Family trip');

    await waitFor(() => expect(leaveApi.preview).toHaveBeenCalledWith('2026-08-07', '2026-08-10', expect.anything()));
    expect(await screen.findByText(/2 working days will be requested — 2 weekend days not counted/i)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /submit request/i }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ leaveType: 'casual', startDate: '2026-08-07', endDate: '2026-08-10', reason: 'Family trip' });
  });

  it('blocks submission when the request exceeds the remaining balance', async () => {
    leaveApi.preview.mockResolvedValue(previewFor(5));
    const { onSubmit } = await setup();
    await userEvent.type(screen.getByLabelText(/start date/i), '2026-08-03');
    await userEvent.type(screen.getByLabelText(/end date/i), '2026-08-07');
    await userEvent.type(screen.getByLabelText(/reason/i), 'Long trip');
    expect(await screen.findByText(/needs 5 working days but only 3 remain for casual leave/i)).toBeInTheDocument();
    const submit = screen.getByRole('button', { name: /submit request/i });
    expect(submit).toBeDisabled();
    await userEvent.click(submit);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('blocks a range with no working days', async () => {
    leaveApi.preview.mockResolvedValue(previewFor(0, { calendarDays: 2, weekendDays: 2 }));
    await setup();
    await userEvent.type(screen.getByLabelText(/start date/i), '2026-08-08');
    await userEvent.type(screen.getByLabelText(/end date/i), '2026-08-09');
    expect(await screen.findByText(/no working days/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /submit request/i })).toBeDisabled();
  });

  it('marks unpaid leave types and shows the remaining balance hint for the selected type', async () => {
    await setup();
    expect(screen.getByText(/3 of 12 days remaining this year/i)).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText(/leave type/i), 'lop');
    expect(screen.getByRole('option', { name: /loss of pay \(unpaid\)/i })).toBeInTheDocument();
    expect(screen.getByText(/30 of 30 days remaining this year · unpaid leave/i)).toBeInTheDocument();
  });

  it('shows the server error and keeps the form open; the submit button reflects submitting', async () => {
    await setup({ serverError: 'Only 3 Casual Leave days remaining this year', submitting: true });
    expect(screen.getByRole('alert')).toHaveTextContent(/only 3 casual leave days/i);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /submit request/i })).toBeDisabled();
  });
});
