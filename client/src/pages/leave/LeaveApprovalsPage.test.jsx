import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { configureStore } from '@reduxjs/toolkit';
import authReducer from '../../features/auth/authSlice';
import { ToastContext } from '../../components/ToastContext';
import LeaveApprovalsPage from './LeaveApprovalsPage';
import { leaveApi } from '../../api/leaveApi';
import { employeeApi } from '../../api/employeeApi';

vi.mock('../../api/leaveApi', () => ({ leaveApi: { list: vi.fn(), approve: vi.fn(), reject: vi.fn() } }));
vi.mock('../../api/employeeApi', () => ({ employeeApi: { options: vi.fn() } }));
vi.mock('../../api/exportApi', () => ({ exportApi: { leaves: vi.fn() } }));

const manager = { id: 'u1', email: 'mia@test.com', role: 'MANAGER', employee: { _id: 'm1', firstName: 'Mia' } };
const pendingLeave = {
  _id: 'l1',
  employee: { _id: 'e1', firstName: 'Rita', lastName: 'Report', employeeId: 'EMP0002' },
  leaveType: { name: 'Casual Leave' },
  startDate: '2026-08-10T00:00:00.000Z',
  endDate: '2026-08-11T00:00:00.000Z',
  days: 2,
  reason: 'Family visit',
  status: 'Pending',
  createdAt: '2026-08-01T00:00:00.000Z',
};
const list = (rows) => ({ data: { success: true, data: rows, pagination: { page: 1, pages: 1, total: rows.length, limit: 10 } } });

function renderPage(user = manager) {
  const store = configureStore({ reducer: { auth: authReducer }, preloadedState: { auth: { user, accessToken: 't', status: 'authenticated', error: null, sessionExpired: false } } });
  const showToast = vi.fn();
  render(
    <Provider store={store}>
      <ToastContext.Provider value={{ showToast }}>
        <MemoryRouter initialEntries={['/leaves/approvals']}>
          <LeaveApprovalsPage />
        </MemoryRouter>
      </ToastContext.Provider>
    </Provider>
  );
  return { showToast };
}

beforeEach(() => {
  vi.clearAllMocks();
  employeeApi.options.mockResolvedValue({ data: { success: true, data: [] } });
});

describe('LeaveApprovalsPage', () => {
  it('loads pending requests by default and shows approve/reject only for pending rows', async () => {
    leaveApi.list.mockResolvedValue(list([pendingLeave, { ...pendingLeave, _id: 'l2', status: 'Approved', approver: { firstName: 'Mia', lastName: 'M' } }]));
    renderPage();
    expect(await screen.findAllByText('Rita Report')).not.toHaveLength(0);
    expect(leaveApi.list).toHaveBeenCalledWith(expect.objectContaining({ status: 'Pending', page: 1 }), expect.anything());
    const table = screen.getByRole('table');
    expect(within(table).getAllByRole('button', { name: /approve request from rita/i })).toHaveLength(1);
    expect(within(table).getAllByRole('button', { name: /reject request from rita/i })).toHaveLength(1);
    expect(within(table).getByText('by Mia M')).toBeInTheDocument();
  });

  it('approves a request with a note, refetches the list and toasts', async () => {
    leaveApi.list.mockResolvedValueOnce(list([pendingLeave])).mockResolvedValueOnce(list([]));
    leaveApi.approve.mockResolvedValue({ data: { success: true } });
    const { showToast } = renderPage();
    const approveButton = (await screen.findAllByRole('button', { name: /approve request from rita/i }))[0];
    await userEvent.click(approveButton);

    const dialog = await screen.findByRole('dialog', { name: /approve leave request/i });
    expect(within(dialog).getByText('Family visit')).toBeInTheDocument();
    const note = within(dialog).getByLabelText(/note for the employee/i);
    await waitFor(() => expect(note).toHaveFocus()); // dialog moves focus on the next frame
    await userEvent.type(note, 'Enjoy');
    await userEvent.click(within(dialog).getByRole('button', { name: /^approve$/i }));

    await waitFor(() => expect(leaveApi.approve).toHaveBeenCalledWith('l1', 'Enjoy'));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(showToast).toHaveBeenCalledWith('Leave request approved');
    expect(leaveApi.list).toHaveBeenCalledTimes(2);
    expect(await screen.findByText(/nothing to review/i)).toBeInTheDocument();
  });

  it('shows the server error inside the dialog when a decision is rejected (e.g. already actioned)', async () => {
    leaveApi.list.mockResolvedValue(list([pendingLeave]));
    leaveApi.reject.mockRejectedValue({ response: { status: 409, data: { message: 'This leave request has already been actioned' } } });
    renderPage();
    await userEvent.click((await screen.findAllByRole('button', { name: /reject request from rita/i }))[0]);
    const dialog = await screen.findByRole('dialog', { name: /reject leave request/i });
    await userEvent.click(within(dialog).getByRole('button', { name: /^reject$/i }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(/already been actioned/i);
    expect(screen.getByRole('dialog')).toBeInTheDocument(); // stays open for the user to read it
  });

  it('switching the status tab refetches with the new filter', async () => {
    leaveApi.list.mockResolvedValue(list([]));
    renderPage();
    await screen.findByText(/nothing to review/i);
    await userEvent.click(screen.getByRole('tab', { name: /approved/i }));
    await waitFor(() => expect(leaveApi.list).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'Approved', page: 1 }), expect.anything()));
    expect(await screen.findByText(/no leave requests/i)).toBeInTheDocument();
  });

  it('shows the export action only to HR', async () => {
    leaveApi.list.mockResolvedValue(list([]));
    renderPage();
    await screen.findByText(/nothing to review/i);
    expect(screen.queryByRole('button', { name: /export/i })).not.toBeInTheDocument();
  });
});
