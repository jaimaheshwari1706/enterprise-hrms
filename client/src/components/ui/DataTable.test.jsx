import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DataTable from './DataTable';

const columns = [
  { key: 'name', header: 'Name', sortKey: 'name', primary: true },
  { key: 'dept', header: 'Department', hideOnMobile: true },
  { key: 'salary', header: 'Salary', align: 'right', sortKey: 'salary', defaultDesc: true, render: (r) => `₹${r.salary}` },
];
const rows = [
  { _id: '1', name: 'Alice', dept: 'Eng', salary: 100 },
  { _id: '2', name: 'Bob', dept: 'Ops', salary: 90 },
];

describe('DataTable', () => {
  it('renders rows with headers and custom cell renderers', () => {
    render(<DataTable columns={columns} rows={rows} />);
    const table = screen.getByRole('table');
    expect(within(table).getByRole('columnheader', { name: /name/i })).toBeInTheDocument();
    expect(within(table).getByText('Alice')).toBeInTheDocument();
    expect(within(table).getByText('₹90')).toBeInTheDocument();
  });

  it('shows a skeleton (not the rows) during the initial load', () => {
    render(<DataTable columns={columns} rows={rows} status="loading" />);
    expect(screen.getByRole('status', { name: /loading/i })).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('shows the error state with a working retry button', async () => {
    const onRetry = vi.fn();
    render(<DataTable columns={columns} rows={[]} status="error" error="Boom" onRetry={onRetry} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Boom');
    await userEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('shows the empty state with its action when there are no rows', () => {
    render(<DataTable columns={columns} rows={[]} emptyTitle="No employees" emptyMessage="Add one to get started" emptyAction={<button type="button">Add</button>} />);
    expect(screen.getByText('No employees')).toBeInTheDocument();
    expect(screen.getByText('Add one to get started')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add' })).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('keeps the previous rows visible while refetching', () => {
    render(<DataTable columns={columns} rows={rows} status="ready" isFetching />);
    expect(within(screen.getByRole('table')).getByText('Alice')).toBeInTheDocument();
  });

  describe('sorting', () => {
    it('marks the active column with aria-sort and toggles direction on click', async () => {
      const onSort = vi.fn();
      const { rerender } = render(<DataTable columns={columns} rows={rows} sort="name" onSort={onSort} />);
      const nameHeader = screen.getByRole('columnheader', { name: /name/i });
      expect(nameHeader).toHaveAttribute('aria-sort', 'ascending');

      await userEvent.click(within(nameHeader).getByRole('button'));
      expect(onSort).toHaveBeenCalledWith('-name');

      rerender(<DataTable columns={columns} rows={rows} sort="-name" onSort={onSort} />);
      expect(screen.getByRole('columnheader', { name: /name/i })).toHaveAttribute('aria-sort', 'descending');
      await userEvent.click(within(screen.getByRole('columnheader', { name: /name/i })).getByRole('button'));
      expect(onSort).toHaveBeenLastCalledWith('name');
    });

    it('starts descending for columns flagged defaultDesc and is inert for unsortable columns', async () => {
      const onSort = vi.fn();
      render(<DataTable columns={columns} rows={rows} sort="name" onSort={onSort} />);
      await userEvent.click(within(screen.getByRole('columnheader', { name: /salary/i })).getByRole('button'));
      expect(onSort).toHaveBeenCalledWith('-salary');
      // "Department" has no sortKey → rendered as plain text, no button.
      expect(within(screen.getByRole('columnheader', { name: /department/i })).queryByRole('button')).toBeNull();
    });
  });

  describe('pagination', () => {
    const pagination = { page: 2, pages: 5, total: 48, limit: 10 };

    it('shows the range summary and navigates pages', async () => {
      const onPageChange = vi.fn();
      render(<DataTable columns={columns} rows={rows} pagination={pagination} onPageChange={onPageChange} />);
      expect(screen.getByText('11–20')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '2' })).toHaveAttribute('aria-current', 'page');
      await userEvent.click(screen.getByRole('button', { name: /next page/i }));
      expect(onPageChange).toHaveBeenCalledWith(3);
      await userEvent.click(screen.getByRole('button', { name: /previous page/i }));
      expect(onPageChange).toHaveBeenCalledWith(1);
      await userEvent.click(screen.getByRole('button', { name: '5' }));
      expect(onPageChange).toHaveBeenCalledWith(5);
    });

    it('disables previous on the first page and next on the last', () => {
      const { rerender } = render(<DataTable columns={columns} rows={rows} pagination={{ ...pagination, page: 1 }} onPageChange={() => {}} />);
      expect(screen.getByRole('button', { name: /previous page/i })).toBeDisabled();
      rerender(<DataTable columns={columns} rows={rows} pagination={{ ...pagination, page: 5 }} onPageChange={() => {}} />);
      expect(screen.getByRole('button', { name: /next page/i })).toBeDisabled();
    });

    it('changes the page size', async () => {
      const onPageSizeChange = vi.fn();
      render(<DataTable columns={columns} rows={rows} pagination={pagination} onPageChange={() => {}} onPageSizeChange={onPageSizeChange} />);
      await userEvent.selectOptions(screen.getByRole('combobox', { name: /rows per page/i }), '25');
      expect(onPageSizeChange).toHaveBeenCalledWith(25);
    });
  });

  describe('mobile layout', () => {
    it('renders a card list alongside the table, using the primary column as the title and hiding hideOnMobile columns', () => {
      render(<DataTable columns={columns} rows={rows} />);
      // The card list is always in the DOM (CSS hides one or the other by breakpoint).
      const list = screen.getByRole('list');
      const cards = within(list).getAllByRole('listitem');
      expect(cards).toHaveLength(2);
      expect(within(cards[0]).getByText('Alice')).toBeInTheDocument();
      // Department is hideOnMobile → no <dt> for it in the card; Salary is shown.
      expect(within(cards[0]).queryByText('Department')).toBeNull();
      expect(within(cards[0]).getByText('Salary')).toBeInTheDocument();
      expect(within(cards[0]).getByText('₹100')).toBeInTheDocument();
    });

    it('fires onRowClick from both the table row and the card', async () => {
      const onRowClick = vi.fn();
      render(<DataTable columns={columns} rows={rows} onRowClick={onRowClick} />);
      await userEvent.click(within(screen.getByRole('table')).getByText('Bob'));
      expect(onRowClick).toHaveBeenLastCalledWith(rows[1]);
      const [firstCard] = within(screen.getByRole('list')).getAllByRole('listitem');
      await userEvent.click(firstCard);
      expect(onRowClick).toHaveBeenLastCalledWith(rows[0]);
    });
  });
});
