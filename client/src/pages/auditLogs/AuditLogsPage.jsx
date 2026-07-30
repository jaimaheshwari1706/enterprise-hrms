import { useCallback, useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { auditLogApi } from '../../api/auditLogApi';
import useDebounce from '../../hooks/useDebounce';
import Pagination from '../../components/Pagination';
import { EmptyState, ErrorState, Loading } from '../../components/StateViews';

const inputClass =
  'rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white';

function formatDateTime(value) {
  return new Date(value).toLocaleString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

export default function AuditLogsPage() {
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search);
  const [actionFilter, setActionFilter] = useState('');
  const [actions, setActions] = useState([]);
  const [page, setPage] = useState(1);

  const [logs, setLogs] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [status, setStatus] = useState('loading');

  useEffect(() => {
    auditLogApi.actions().then(({ data }) => setActions(data.data));
  }, []);

  const fetchLogs = useCallback(async () => {
    setStatus('loading');
    try {
      const { data } = await auditLogApi.list({
        page,
        limit: 15,
        search: debouncedSearch || undefined,
        action: actionFilter || undefined,
      });
      setLogs(data.data);
      setPagination(data.pagination);
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  }, [page, debouncedSearch, actionFilter]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, actionFilter]);

  return (
    <div>
      <h1 className="mb-1 text-xl font-semibold text-slate-900 dark:text-white">Audit Logs</h1>
      <p className="mb-6 text-sm text-slate-500 dark:text-slate-400">A record of important actions taken across the system.</p>

      <div className="mb-4 flex flex-wrap gap-3">
        <div className="relative max-w-xs flex-1">
          <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search descriptions…"
            className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          />
        </div>
        <select value={actionFilter} onChange={(e) => setActionFilter(e.target.value)} className={inputClass}>
          <option value="">All actions</option>
          {actions.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        {status === 'loading' && <Loading label="Loading audit logs…" />}
        {status === 'error' && <ErrorState message="Failed to load audit logs." />}
        {status === 'ready' && logs.length === 0 && (
          <EmptyState title="No audit logs found" message="Try adjusting your search or filters." />
        )}
        {status === 'ready' && logs.length > 0 && (
          <>
            <div className="overflow-x-auto"><table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 text-xs uppercase text-slate-500 dark:border-slate-800 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3 font-medium">Timestamp</th>
                  <th className="px-4 py-3 font-medium">User</th>
                  <th className="px-4 py-3 font-medium">Action</th>
                  <th className="px-4 py-3 font-medium">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {logs.map((log) => (
                  <tr key={log._id} className="text-slate-700 dark:text-slate-200">
                    <td className="whitespace-nowrap px-4 py-3 text-slate-500 dark:text-slate-400">{formatDateTime(log.createdAt)}</td>
                    <td className="px-4 py-3">{log.user?.email || 'System'}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                        {log.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{log.description}</td>
                  </tr>
                ))}
              </tbody>
            </table></div>
            <Pagination pagination={pagination} onPageChange={setPage} />
          </>
        )}
      </div>
    </div>
  );
}
