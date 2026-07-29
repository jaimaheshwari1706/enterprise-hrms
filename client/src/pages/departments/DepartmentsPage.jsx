import { useCallback, useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { Plus, Pencil, Trash2, Search } from 'lucide-react';
import { departmentApi } from '../../api/departmentApi';
import { selectCurrentUser } from '../../features/auth/authSlice';
import { useToast } from '../../components/ToastProvider';
import useDebounce from '../../hooks/useDebounce';
import Button from '../../components/Button';
import Pagination from '../../components/Pagination';
import ConfirmDialog from '../../components/ConfirmDialog';
import { EmptyState, ErrorState, Loading } from '../../components/StateViews';
import DepartmentFormModal from './DepartmentFormModal';

export default function DepartmentsPage() {
  const user = useSelector(selectCurrentUser);
  const canManage = user?.role === 'HR_ADMIN' || user?.role === 'SUPER_ADMIN';
  const { showToast } = useToast();

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search);
  const [page, setPage] = useState(1);
  const [departments, setDepartments] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [status, setStatus] = useState('loading'); // loading | ready | error

  const [formOpen, setFormOpen] = useState(false);
  const [editingDept, setEditingDept] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const fetchDepartments = useCallback(async () => {
    setStatus('loading');
    try {
      const { data } = await departmentApi.list({ page, limit: 10, search: debouncedSearch || undefined });
      setDepartments(data.data);
      setPagination(data.pagination);
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  }, [page, debouncedSearch]);

  useEffect(() => {
    fetchDepartments();
  }, [fetchDepartments]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  const openCreateForm = () => {
    setEditingDept(null);
    setFormOpen(true);
  };

  const openEditForm = (dept) => {
    setEditingDept(dept);
    setFormOpen(true);
  };

  const handleFormSubmit = async (values) => {
    setSubmitting(true);
    try {
      if (editingDept) {
        await departmentApi.update(editingDept._id, values);
        showToast('Department updated successfully');
      } else {
        await departmentApi.create(values);
        showToast('Department created successfully');
      }
      setFormOpen(false);
      fetchDepartments();
    } catch (err) {
      showToast(err.response?.data?.message || 'Something went wrong', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await departmentApi.remove(deleteTarget._id);
      showToast('Department deleted successfully');
      setDeleteTarget(null);
      fetchDepartments();
    } catch (err) {
      showToast(err.response?.data?.message || 'Unable to delete department', 'error');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-white">Departments</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Manage your organization's departments.</p>
        </div>
        {canManage && (
          <Button onClick={openCreateForm}>
            <Plus size={16} /> Add Department
          </Button>
        )}
      </div>

      <div className="mb-4">
        <div className="relative max-w-xs">
          <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search departments…"
            className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        {status === 'loading' && <Loading label="Loading departments…" />}
        {status === 'error' && <ErrorState message="Failed to load departments. Please try again." />}
        {status === 'ready' && departments.length === 0 && (
          <EmptyState
            title="No departments found"
            message={search ? 'Try a different search term.' : 'Get started by adding your first department.'}
          />
        )}

        {status === 'ready' && departments.length > 0 && (
          <>
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 text-xs uppercase text-slate-500 dark:border-slate-800 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Code</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  {canManage && <th className="px-4 py-3 font-medium">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {departments.map((dept) => (
                  <tr key={dept._id} className="text-slate-700 dark:text-slate-200">
                    <td className="px-4 py-3 font-medium">{dept.name}</td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{dept.code}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          dept.status === 'active'
                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400'
                            : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                        }`}
                      >
                        {dept.status}
                      </span>
                    </td>
                    {canManage && (
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          <button
                            onClick={() => openEditForm(dept)}
                            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            onClick={() => setDeleteTarget(dept)}
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
            </table>
            <Pagination pagination={pagination} onPageChange={setPage} />
          </>
        )}
      </div>

      <DepartmentFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSubmit={handleFormSubmit}
        department={editingDept}
        submitting={submitting}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete department"
        message={`Are you sure you want to delete "${deleteTarget?.name}"? This cannot be undone.`}
        confirmLabel="Delete"
        loading={deleting}
      />
    </div>
  );
}
