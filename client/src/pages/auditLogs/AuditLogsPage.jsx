import { ScrollText } from 'lucide-react';
import { auditLogApi } from '../../api/auditLogApi';
import useDebounce from '../../hooks/useDebounce';
import { useApiQuery } from '../../hooks/useApiQuery';
import { useListParams } from '../../hooks/useListParams';
import { Button, Card, PageHeader, DataTable, Badge, Input, Select, SearchInput, Toolbar, Avatar, NoResults } from '../../components/ui';
import { formatDateTime, roleLabel } from '../../utils/format';

const ENTITY_TYPES = ['User', 'Employee', 'Department', 'Designation', 'LeaveRequest', 'Payroll', 'Salary', 'Organization'];

function actionTone(action = '') {
  if (/DELETE|REJECT|DEACTIVATE/.test(action)) return 'danger';
  if (/CREATE|APPROVE|ACTIVATE|GENERATE/.test(action)) return 'success';
  if (/LOGIN|PASSWORD/.test(action)) return 'info';
  return 'neutral';
}

export default function AuditLogsPage() {
  const list = useListParams({ pageSize: 15, sort: '-createdAt', filters: { search: '', action: '', entityType: '', from: '', to: '' } });
  const debouncedSearch = useDebounce(list.filters.search);
  const queryParams = { ...list.params, search: debouncedSearch || undefined };
  const logs = useApiQuery((signal) => auditLogApi.list(queryParams, { signal }), [JSON.stringify(queryParams)]);
  const actions = useApiQuery((signal) => auditLogApi.actions({ signal }), []);

  const columns = [
    {
      key: 'createdAt',
      header: 'When',
      sortKey: 'createdAt',
      defaultDesc: true,
      width: 180,
      render: (log) => <span className="whitespace-nowrap text-slate-600 tabular dark:text-slate-300">{formatDateTime(log.createdAt)}</span>,
    },
    {
      key: 'user',
      header: 'User',
      render: (log) => (
        <div className="flex items-center gap-2">
          <Avatar name={log.user?.email || 'System'} size={26} />
          <div className="min-w-0">
            <p className="truncate text-slate-800 dark:text-slate-100">{log.user?.email || 'System'}</p>
            {log.user?.role && <p className="text-[11px] text-slate-400">{roleLabel(log.user.role)}</p>}
          </div>
        </div>
      ),
    },
    { key: 'action', header: 'Action', sortKey: 'action', render: (log) => <Badge tone={actionTone(log.action)}>{log.action.replace(/_/g, ' ')}</Badge> },
    { key: 'entityType', header: 'Entity', sortKey: 'entityType', render: (log) => log.entityType, className: 'text-slate-600 dark:text-slate-300', hideOnMobile: true },
    { key: 'description', header: 'Description', primary: true, render: (log) => <span className="text-slate-700 dark:text-slate-200">{log.description || '—'}</span> },
    { key: 'ipAddress', header: 'IP', render: (log) => <span className="font-mono text-xs text-slate-400">{log.ipAddress || '—'}</span>, hideOnMobile: true },
  ];

  return (
    <div>
      <PageHeader title="Audit Logs" description="A record of important actions taken across the system." />

      <Toolbar
        actions={
          list.hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={list.resetFilters}>
              Clear filters
            </Button>
          )
        }
      >
        <SearchInput value={list.filters.search} onChange={(v) => list.setFilter('search', v)} placeholder="Search descriptions…" className="w-full sm:w-64" />
        <Select value={list.filters.action} onChange={(e) => list.setFilter('action', e.target.value)} aria-label="Filter by action" className="w-full sm:w-52">
          <option value="">All actions</option>
          {(actions.data || []).map((a) => (
            <option key={a} value={a}>
              {a.replace(/_/g, ' ')}
            </option>
          ))}
        </Select>
        <Select value={list.filters.entityType} onChange={(e) => list.setFilter('entityType', e.target.value)} aria-label="Filter by entity" className="w-full sm:w-44">
          <option value="">All entities</option>
          {ENTITY_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </Select>
        <Input type="date" value={list.filters.from} max={list.filters.to || undefined} onChange={(e) => list.setFilter('from', e.target.value)} aria-label="From date" className="w-full sm:w-40" />
        <Input type="date" value={list.filters.to} min={list.filters.from || undefined} onChange={(e) => list.setFilter('to', e.target.value)} aria-label="To date" className="w-full sm:w-40" />
      </Toolbar>

      <Card>
        {logs.status === 'ready' && logs.data?.length === 0 && (list.hasActiveFilters || debouncedSearch) ? (
          <NoResults onClear={list.resetFilters} />
        ) : (
          <DataTable
            caption="Audit logs"
            columns={columns}
            rows={logs.data || []}
            status={logs.status}
            isFetching={logs.isFetching}
            error={logs.error}
            onRetry={logs.refetch}
            sort={list.sort}
            onSort={list.setSort}
            pagination={logs.pagination}
            onPageChange={list.setPage}
            onPageSizeChange={list.setPageSize}
            emptyIcon={ScrollText}
            emptyTitle="No activity recorded yet"
            emptyMessage="Logins, approvals, payroll runs and other important actions will be listed here."
            dense
          />
        )}
      </Card>
    </div>
  );
}
