import { useState } from 'react';
import { useSelector } from 'react-redux';
import { Plus, Pencil, Trash2, Boxes } from 'lucide-react';
import { departmentApi } from '../../api/departmentApi';
import { selectCurrentUser } from '../../features/auth/authSlice';
import { useToast } from '../../hooks/useToast';
import useDebounce from '../../hooks/useDebounce';
import { useApiQuery } from '../../hooks/useApiQuery';
import { useListParams } from '../../hooks/useListParams';
import { Button, IconButton, Select, SearchInput, Toolbar, Card, PageHeader, DataTable, StatusBadge, ConfirmDialog, NoResults } from '../../components/ui';
import { formatDate, fullName } from '../../utils/format';
import { getApiErrorMessage } from '../../utils/apiError';
import DepartmentFormModal from './DepartmentFormModal';

export default function DepartmentsPage() {
  const user = useSelector(selectCurrentUser);
  const canManage = user?.role === 'HR_ADMIN' || user?.role === 'SUPER_ADMIN';
  const { showToast } = useToast();

  const list = useListParams({ pageSize: 10, sort: 'name', filters: { search: '', status: '' } });
  const debouncedSearch = useDebounce(list.filters.search);
  const queryParams = { ...list.params, search: debouncedSearch || undefined };
  const departments = useApiQuery((signal) => departmentApi.list(queryParams, { signal }), [JSON.stringify(queryParams)]);

  const [formOpen, setFormOpen] = useState(false);
  const [editingDept, setEditingDept] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const openCreateForm = () => {
    setEditingDept(null);
    setFormError(null);
    setFormOpen(true);
  };

  const openEditForm = (dept) => {
    setEditingDept(dept);
    setFormError(null);
    setFormOpen(true);
  };

  const handleFormSubmit = async (values) => {
    setSubmitting(true);
    setFormError(null);
    try {
      if (editingDept) {
        await departmentApi.update(editingDept._id, values);
        showToast('Department updated');
      } else {
        await departmentApi.create(values);
        showToast('Department created');
      }
      setFormOpen(false);
      departments.refetch();
    } catch (err) {
      setFormError(getApiErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await departmentApi.remove(deleteTarget._id);
      showToast('Department deleted');
      setDeleteTarget(null);
      departments.refetch();
    } catch (err) {
      showToast(getApiErrorMessage(err, 'Unable to delete department.'), 'error');
    } finally {
      setDeleting(false);
    }
  };

  const columns = [
    {
      key: 'name',
      header: 'Department',
      sortKey: 'name',
      primary: true,
      render: (dept) => (
        <div className="min-w-0">
          <p className="font-medium text-slate-900 dark:text-white">{dept.name}</p>
          {dept.description && <p className="truncate text-xs text-slate-500 dark:text-slate-400">{dept.description}</p>}
        </div>
      ),
    },
    { key: 'code', header: 'Code', sortKey: 'code', render: (dept) => <span className="font-mono text-xs text-slate-600 dark:text-slate-300">{dept.code}</span> },
    { key: 'head', header: 'Head', render: (dept) => (dept.head ? fullName(dept.head) : '—'), className: 'text-slate-600 dark:text-slate-300' },
    { key: 'createdAt', header: 'Created', sortKey: 'createdAt', render: (dept) => formatDate(dept.createdAt), className: 'text-slate-600 tabular dark:text-slate-300', hideOnMobile: true },
    { key: 'status', header: 'Status', sortKey: 'status', render: (dept) => <StatusBadge status={dept.status} /> },
    ...(canManage
      ? [
          {
            key: 'actions',
            header: <span className="sr-only">Actions</span>,
            isActions: true,
            align: 'right',
            width: 96,
            render: (dept) => (
              <div className="flex items-center justify-end gap-0.5">
                <IconButton label={`Edit ${dept.name}`} icon={Pencil} onClick={() => openEditForm(dept)} />
                <IconButton label={`Delete ${dept.name}`} icon={Trash2} tone="danger" onClick={() => setDeleteTarget(dept)} />
              </div>
            ),
          },
        ]
      : []),
  ];

  return (
    <div>
      <PageHeader
        title="Departments"
        description="Organize employees into departments."
        actions={
          canManage && (
            <Button icon={Plus} onClick={openCreateForm}>
              Add department
            </Button>
          )
        }
      />

      <Toolbar>
        <SearchInput value={list.filters.search} onChange={(v) => list.setFilter('search', v)} placeholder="Search by name or code…" className="w-full sm:w-72" />
        <Select value={list.filters.status} onChange={(e) => list.setFilter('status', e.target.value)} aria-label="Filter by status" className="w-full sm:w-36">
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </Select>
      </Toolbar>

      <Card>
        {departments.status === 'ready' && departments.data?.length === 0 && (list.hasActiveFilters || debouncedSearch) ? (
          <NoResults onClear={list.resetFilters} />
        ) : (
          <DataTable
            caption="Departments"
            columns={columns}
            rows={departments.data || []}
            status={departments.status}
            isFetching={departments.isFetching}
            error={departments.error}
            onRetry={departments.refetch}
            sort={list.sort}
            onSort={list.setSort}
            pagination={departments.pagination}
            onPageChange={list.setPage}
            onPageSizeChange={list.setPageSize}
            emptyIcon={Boxes}
            emptyTitle="No departments yet"
            emptyMessage="Departments group employees and designations. Create the first one to get started."
            emptyAction={canManage ? <Button icon={Plus} onClick={openCreateForm}>Add department</Button> : null}
          />
        )}
      </Card>

      <DepartmentFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSubmit={handleFormSubmit}
        department={editingDept}
        submitting={submitting}
        serverError={formError}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete department"
        message={`"${deleteTarget?.name}" will be permanently deleted. This is only possible when no designations or employees are assigned to it.`}
        confirmLabel="Delete"
        loading={deleting}
      />
    </div>
  );
}
