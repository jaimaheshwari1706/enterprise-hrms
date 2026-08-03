import { useCallback, useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { Plus, Pencil, Trash2, Search } from 'lucide-react';
import { designationApi } from '../../api/designationApi';
import { departmentApi } from '../../api/departmentApi';
import { selectCurrentUser } from '../../features/auth/authSlice';
import { useToast } from '../../hooks/useToast';
import useDebounce from '../../hooks/useDebounce';
import Button from '../../components/Button';
import Pagination from '../../components/Pagination';
import ConfirmDialog from '../../components/ConfirmDialog';
import { EmptyState, ErrorState, Loading } from '../../components/StateViews';
import DesignationFormModal from './DesignationFormModal';

export default function DesignationsPage() {
  const user = useSelector(selectCurrentUser);
  const canManage = user?.role === 'HR_ADMIN' || user?.role === 'SUPER_ADMIN';
  const { showToast } = useToast();

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search);
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [page, setPage] = useState(1);

  const [designations, setDesignations] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [status, setStatus] = useState('loading');

  const [formOpen, setFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Departments are needed for both the filter dropdown and the form's
  // department select — fetched once with a high limit since dropdown
  // lists don't need their own pagination UI.
  useEffect(() => {
    departmentApi.list({ limit: 100, status: 'active' }).then(({ data }) => setDepartments(data.data));
  }, []);

  const fetchDesignations = useCallback(async () => {
    setStatus('loading');
    try {
      const { data } = await designationApi.list({
        page,
        limit: 10,
        search: debouncedSearch || undefined,
        department: departmentFilter || undefined,
      });
      setDesignations(data.data);
      setPagination(data.pagination);
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  }, [page, debouncedSearch, departmentFilter]);

  useEffect(() => {
    fetchDesignations();
  }, [fetchDesignations]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, departmentFilter]);

  const openCreateForm = () => {
    setEditingItem(null);
    setFormOpen(true);
  };

  const openEditForm = (item) => {
    setEditingItem(item);
    setFormOpen(true);
  };

  const handleFormSubmit = async (values) => {
    setSubmitting(true);
    try {
      if (editingItem) {
        await designationApi.update(editingItem._id, values);
        showToast('Designation updated successfully');
      } else {
        await designationApi.create(values);
        showToast('Designation created successfully');
      }
      setFormOpen(false);
      fetchDesignations();
    } catch (err) {
      showToast(err.response?.data?.message || 'Something went wrong', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await designationApi.remove(deleteTarget._id);
      showToast('Designation deleted successfully');
      setDeleteTarget(null);
      fetchDesignations();
    } catch (err) {
      showToast(err.response?.data?.message || 'Unable to delete designation', 'error');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-white">Designations</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Manage job titles within each department.</p>
        </div>
        {canManage && (
          <Button onClick={openCreateForm} disabled={departments.length === 0}>
            <Plus size={16} /> Add Designation
          </Button>
        )}
      </div>

      <div className="mb-4 flex flex-wrap gap-3">
        <div className="relative max-w-xs flex-1">
          <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search designations…"
            className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          />
        </div>
        <select
          value={departmentFilter}
          onChange={(e) => setDepartmentFilter(e.target.value)}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
        >
          <option value="">All departments</option>
          {departments.map((d) => (
            <option key={d._id} value={d._id}>
              {d.name}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        {status === 'loading' && <Loading label="Loading designations…" />}
        {status === 'error' && <ErrorState message="Failed to load designations. Please try again." />}
        {status === 'ready' && designations.length === 0 && (
          <EmptyState
            title="No designations found"
            message={
              departments.length === 0
                ? 'Create a department first before adding designations.'
                : 'Get started by adding your first designation.'
            }
          />
        )}

        {status === 'ready' && designations.length > 0 && (
          <>
            <div className="overflow-x-auto"><table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 text-xs uppercase text-slate-500 dark:border-slate-800 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Code</th>
                  <th className="px-4 py-3 font-medium">Department</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  {canManage && <th className="px-4 py-3 font-medium">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {designations.map((item) => (
                  <tr key={item._id} className="text-slate-700 dark:text-slate-200">
                    <td className="px-4 py-3 font-medium">{item.name}</td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{item.code}</td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{item.department?.name || '—'}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          item.status === 'active'
                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400'
                            : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                        }`}
                      >
                        {item.status}
                      </span>
                    </td>
                    {canManage && (
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          <button
                            onClick={() => openEditForm(item)}
                            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            onClick={() => setDeleteTarget(item)}
                            className="rounded-lg p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table></div>
            <Pagination pagination={pagination} onPageChange={setPage} />
          </>
        )}
      </div>

      <DesignationFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSubmit={handleFormSubmit}
        designation={editingItem}
        departments={departments}
        submitting={submitting}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete designation"
        message={`Are you sure you want to delete "${deleteTarget?.name}"? This cannot be undone.`}
        confirmLabel="Delete"
        loading={deleting}
      />
    </div>
  );
}
