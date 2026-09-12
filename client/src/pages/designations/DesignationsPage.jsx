import { useState } from 'react';
import { useSelector } from 'react-redux';
import { Plus, Pencil, Trash2, Briefcase } from 'lucide-react';
import { designationApi } from '../../api/designationApi';
import { departmentApi } from '../../api/departmentApi';
import { selectCurrentUser } from '../../features/auth/authSlice';
import { useToast } from '../../hooks/useToast';
import useDebounce from '../../hooks/useDebounce';
import { useApiQuery } from '../../hooks/useApiQuery';
import { useListParams } from '../../hooks/useListParams';
import { Button, IconButton, Select, SearchInput, Toolbar, Card, PageHeader, DataTable, StatusBadge, ConfirmDialog, NoResults } from '../../components/ui';
import { getApiErrorMessage } from '../../utils/apiError';
import DesignationFormModal from './DesignationFormModal';

export default function DesignationsPage() {
  const user = useSelector(selectCurrentUser);
  const canManage = user?.role === 'HR_ADMIN' || user?.role === 'SUPER_ADMIN';
  const { showToast } = useToast();

  const list = useListParams({ pageSize: 10, sort: 'name', filters: { search: '', department: '', status: '' } });
  const debouncedSearch = useDebounce(list.filters.search);
  const queryParams = { ...list.params, search: debouncedSearch || undefined };
  const designations = useApiQuery((signal) => designationApi.list(queryParams, { signal }), [JSON.stringify(queryParams)]);
  // Departments are needed for both the filter dropdown and the form's select.
  const departments = useApiQuery((signal) => departmentApi.list({ limit: 100, status: 'active', sort: 'name' }, { signal }), []);
  const departmentOptions = departments.data || [];

  const [formOpen, setFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const openCreateForm = () => {
    setEditingItem(null);
    setFormError(null);
    setFormOpen(true);
  };

  const openEditForm = (item) => {
    setEditingItem(item);
    setFormError(null);
    setFormOpen(true);
  };

  const handleFormSubmit = async (values) => {
    setSubmitting(true);
    setFormError(null);
    try {
      if (editingItem) {
        await designationApi.update(editingItem._id, values);
        showToast('Designation updated');
      } else {
        await designationApi.create(values);
        showToast('Designation created');
      }
      setFormOpen(false);
      designations.refetch();
    } catch (err) {
      setFormError(getApiErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await designationApi.remove(deleteTarget._id);
      showToast('Designation deleted');
      setDeleteTarget(null);
      designations.refetch();
    } catch (err) {
      showToast(getApiErrorMessage(err, 'Unable to delete designation.'), 'error');
    } finally {
      setDeleting(false);
    }
  };

  const columns = [
    {
      key: 'name',
      header: 'Designation',
      sortKey: 'name',
      primary: true,
      render: (item) => (
        <div className="min-w-0">
          <p className="font-medium text-slate-900 dark:text-white">{item.name}</p>
          {item.description && <p className="truncate text-xs text-slate-500 dark:text-slate-400">{item.description}</p>}
        </div>
      ),
    },
    { key: 'code', header: 'Code', sortKey: 'code', render: (item) => <span className="font-mono text-xs text-slate-600 dark:text-slate-300">{item.code}</span> },
    { key: 'department', header: 'Department', render: (item) => item.department?.name || '—', className: 'text-slate-600 dark:text-slate-300' },
    { key: 'status', header: 'Status', sortKey: 'status', render: (item) => <StatusBadge status={item.status} /> },
    ...(canManage
      ? [
          {
            key: 'actions',
            header: <span className="sr-only">Actions</span>,
            isActions: true,
            align: 'right',
            width: 96,
            render: (item) => (
              <div className="flex items-center justify-end gap-0.5">
                <IconButton label={`Edit ${item.name}`} icon={Pencil} onClick={() => openEditForm(item)} />
                <IconButton label={`Delete ${item.name}`} icon={Trash2} tone="danger" onClick={() => setDeleteTarget(item)} />
              </div>
            ),
          },
        ]
      : []),
  ];

  return (
    <div>
      <PageHeader
        title="Designations"
        description="Job titles within each department."
        actions={
          canManage && (
            <Button icon={Plus} onClick={openCreateForm} disabled={departments.status === 'ready' && departmentOptions.length === 0}>
              Add designation
            </Button>
          )
        }
      />

      <Toolbar>
        <SearchInput value={list.filters.search} onChange={(v) => list.setFilter('search', v)} placeholder="Search by name or code…" className="w-full sm:w-72" />
        <Select value={list.filters.department} onChange={(e) => list.setFilter('department', e.target.value)} aria-label="Filter by department" className="w-full sm:w-48">
          <option value="">All departments</option>
          {departmentOptions.map((d) => (
            <option key={d._id} value={d._id}>
              {d.name}
            </option>
          ))}
        </Select>
        <Select value={list.filters.status} onChange={(e) => list.setFilter('status', e.target.value)} aria-label="Filter by status" className="w-full sm:w-36">
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </Select>
      </Toolbar>

      <Card>
        {designations.status === 'ready' && designations.data?.length === 0 && (list.hasActiveFilters || debouncedSearch) ? (
          <NoResults onClear={list.resetFilters} />
        ) : (
          <DataTable
            caption="Designations"
            columns={columns}
            rows={designations.data || []}
            status={designations.status}
            isFetching={designations.isFetching}
            error={designations.error}
            onRetry={designations.refetch}
            sort={list.sort}
            onSort={list.setSort}
            pagination={designations.pagination}
            onPageChange={list.setPage}
            onPageSizeChange={list.setPageSize}
            emptyIcon={Briefcase}
            emptyTitle="No designations yet"
            emptyMessage={departmentOptions.length === 0 ? 'Create a department first, then add designations to it.' : 'Add the first job title to get started.'}
            emptyAction={canManage && departmentOptions.length > 0 ? <Button icon={Plus} onClick={openCreateForm}>Add designation</Button> : null}
          />
        )}
      </Card>

      <DesignationFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSubmit={handleFormSubmit}
        designation={editingItem}
        departments={departmentOptions}
        submitting={submitting}
        serverError={formError}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete designation"
        message={`"${deleteTarget?.name}" will be permanently deleted. This is only possible when no employees hold this designation.`}
        confirmLabel="Delete"
        loading={deleting}
      />
    </div>
  );
}
