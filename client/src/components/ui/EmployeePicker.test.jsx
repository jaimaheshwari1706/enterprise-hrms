import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import EmployeePicker from './EmployeePicker';
import { employeeApi } from '../../api/employeeApi';

vi.mock('../../api/employeeApi', () => ({ employeeApi: { search: vi.fn(), get: vi.fn() } }));

const people = [
  { _id: 'e1', firstName: 'Rita', lastName: 'Report', employeeId: 'EMP0002', department: { name: 'Eng' } },
  { _id: 'e2', firstName: 'Ravi', lastName: 'Rao', employeeId: 'EMP0003' },
];

beforeEach(() => {
  vi.clearAllMocks();
  employeeApi.search.mockResolvedValue({ data: { data: people } });
});

describe('EmployeePicker', () => {
  it('searches server-side after typing and selects with the keyboard', async () => {
    const onChange = vi.fn();
    render(<EmployeePicker onChange={onChange} aria-label="Filter by employee" />);
    const box = screen.getByRole('combobox', { name: /filter by employee/i });
    await userEvent.type(box, 'ra');
    await waitFor(() => expect(employeeApi.search).toHaveBeenCalledWith('ra', expect.anything()));
    const options = await screen.findAllByRole('option');
    expect(options).toHaveLength(2);
    expect(options[0]).toHaveAttribute('aria-selected', 'true');

    await userEvent.keyboard('{ArrowDown}{Enter}');
    expect(onChange).toHaveBeenCalledWith('e2', people[1]);
    expect(screen.getByText('Ravi Rao')).toBeInTheDocument();
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('does not hit the API for very short queries', async () => {
    render(<EmployeePicker onChange={() => {}} aria-label="Pick" />);
    await userEvent.type(screen.getByRole('combobox'), 'r');
    await new Promise((r) => setTimeout(r, 400));
    expect(employeeApi.search).not.toHaveBeenCalled();
  });

  it('clears the selection with the clear button and reports an empty value', async () => {
    const onChange = vi.fn();
    render(<EmployeePicker value="e1" selected={people[0]} onChange={onChange} aria-label="Pick" />);
    expect(screen.getByText('Rita Report')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /clear rita report/i }));
    expect(onChange).toHaveBeenCalledWith('', null);
    expect(screen.queryByText('Rita Report')).not.toBeInTheDocument();
  });

  it('resolves a bare id to a name with one lookup', async () => {
    employeeApi.get.mockResolvedValue({ data: { data: people[1] } });
    render(<EmployeePicker value="e2" onChange={() => {}} aria-label="Pick" />);
    expect(await screen.findByText('Ravi Rao')).toBeInTheDocument();
    expect(employeeApi.get).toHaveBeenCalledWith('e2', expect.anything());
  });

  it('excludes ids passed in `exclude` and shows an empty message when nothing matches', async () => {
    render(<EmployeePicker onChange={() => {}} exclude={['e1', 'e2']} aria-label="Pick" />);
    await userEvent.type(screen.getByRole('combobox'), 'ra');
    expect(await screen.findByText(/no employees found/i)).toBeInTheDocument();
  });
});
