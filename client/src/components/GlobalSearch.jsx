import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { Search, Loader2, Layers, Briefcase, CalendarDays, Wallet, CornerDownLeft } from 'lucide-react';
import clsx from 'clsx';
import { searchApi } from '../api/searchApi';
import { selectCurrentUser, selectIsHR } from '../features/auth/authSlice';
import { Avatar, StatusBadge } from './ui';
import useDebounce from '../hooks/useDebounce';
import { isCancelledRequest } from '../utils/apiError';
import { fullName, formatDate, formatMonth } from '../utils/format';
import { matchCommandPages } from '../utils/commandPages';

// Command palette: one box that finds people, departments, leave requests,
// payslips and pages. Results come from GET /api/search, which applies the
// same role scoping as each list endpoint, plus a client-side page list
// filtered by role. Keyboard: ↑/↓ move, Enter opens, Esc closes; it exposes
// the combobox/listbox contract so screen readers announce results.
export default function GlobalSearch({ autoFocus = false }) {
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounce(query, 250);
  const [results, setResults] = useState(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef(null);
  const navigate = useNavigate();
  const user = useSelector(selectCurrentUser);
  const isHR = useSelector(selectIsHR);
  const isManager = user?.role === 'MANAGER';

  useEffect(() => {
    if (debouncedQuery.trim().length < 2) {
      setResults(null);
      setLoading(false);
      return undefined;
    }
    const controller = new AbortController();
    setLoading(true);
    searchApi
      .global(debouncedQuery, { signal: controller.signal })
      .then(({ data }) => setResults(data.data))
      .catch((err) => {
        if (!isCancelledRequest(err)) setResults({ employees: [], departments: [], leaves: [], payroll: [] });
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [debouncedQuery]);

  // Flatten groups into one ordered list for keyboard navigation.
  const items = useMemo(() => {
    const q = query.trim();
    const list = [];
    const pages = matchCommandPages(q, user).slice(0, q ? 4 : 6);
    for (const page of pages) {
      list.push({ id: `page:${page.to}`, group: page.action ? 'Actions' : 'Pages', label: page.label, icon: page.icon, to: page.to });
    }
    if (!results) return list;
    for (const emp of results.employees) {
      list.push({
        id: `emp:${emp._id}`,
        group: 'Employees',
        label: fullName(emp),
        meta: [emp.employeeId, emp.designation?.name, emp.department?.name].filter(Boolean).join(' · '),
        avatar: emp,
        to: `/employees/${emp._id}`,
      });
    }
    for (const d of results.departments) {
      list.push({
        id: `${d.kind}:${d._id}`,
        group: 'Departments',
        label: d.name,
        meta: d.kind === 'designation' ? `Designation · ${d.department || ''}` : `Department · ${d.code || ''}`,
        icon: d.kind === 'designation' ? Briefcase : Layers,
        to: d.kind === 'designation' ? '/designations' : '/departments',
      });
    }
    for (const l of results.leaves) {
      list.push({
        id: `leave:${l._id}`,
        group: 'Leave requests',
        label: `${fullName(l.employee)} · ${l.leaveType?.name || 'Leave'}`,
        meta: `${formatDate(l.startDate)} – ${formatDate(l.endDate)} · ${l.days} day${l.days === 1 ? '' : 's'}`,
        status: l.status,
        icon: CalendarDays,
        to: isHR || isManager ? `/leaves/approvals?status=${l.status}` : '/leaves',
      });
    }
    for (const p of results.payroll) {
      list.push({
        id: `pay:${p._id}`,
        group: 'Payslips',
        label: p.employee ? `${fullName(p.employee)} · ${formatMonth(p.month)}` : `Payslip · ${formatMonth(p.month)}`,
        meta: p.payslipNumber || undefined,
        status: p.status,
        icon: Wallet,
        to: `/payroll/${p._id}`,
      });
    }
    return list;
  }, [results, query, user, isHR, isManager]);

  useEffect(() => {
    setActiveIndex(0);
  }, [items.length, debouncedQuery]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const goTo = (item) => {
    setOpen(false);
    setQuery('');
    navigate(item.to);
  };

  const onKeyDown = (e) => {
    if (e.key === 'Escape') {
      setOpen(false);
      return;
    }
    if (!open || items.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % items.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => (i - 1 + items.length) % items.length);
    } else if (e.key === 'Enter' && items[activeIndex]) {
      e.preventDefault();
      goTo(items[activeIndex]);
    }
  };

  const showPanel = open && (query.trim().length >= 2 || items.length > 0);
  const searching = query.trim().length >= 2 && (loading || debouncedQuery !== query);
  const active = items[activeIndex];

  // Render grouped, but keep a single flat index for aria-activedescendant.
  let renderIndex = -1;
  const groups = [];
  for (const item of items) {
    const last = groups[groups.length - 1];
    if (last && last.name === item.group) last.items.push(item);
    else groups.push({ name: item.group, items: [item] });
  }

  return (
    <div className="relative w-full" ref={containerRef}>
      <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} aria-hidden="true" />
      <input
        id="global-search-input"
        type="search"
        role="combobox"
        aria-expanded={showPanel}
        aria-controls={showPanel ? 'global-search-results' : undefined}
        aria-autocomplete="list"
        aria-activedescendant={showPanel && active ? `global-search-option-${active.id}` : undefined}
        autoFocus={autoFocus}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder="Search people, leave, payslips, pages…"
        aria-label="Search"
        className="ui-input h-9 bg-slate-50 pl-9 pr-16 [&::-webkit-search-cancel-button]:hidden dark:bg-slate-800/60"
      />
      <span className="pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 items-center gap-1 sm:flex" aria-hidden="true">
        {searching ? <Loader2 size={14} className="animate-spin text-slate-400" /> : <kbd className="ui-kbd">Ctrl K</kbd>}
      </span>

      {showPanel && (
        <div
          id="global-search-results"
          role="listbox"
          aria-label="Search results"
          className="absolute left-0 right-0 z-50 mt-2 max-h-[70vh] origin-top animate-scale-in overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-popover dark:border-slate-700 dark:bg-slate-900"
        >
          {items.length === 0 ? (
            <p className="p-4 text-center text-sm text-slate-500 dark:text-slate-400" role="status">
              {searching ? 'Searching…' : 'No matches'}
            </p>
          ) : (
            groups.map((group) => (
              <div key={group.name} role="group" aria-label={group.name}>
                <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{group.name}</p>
                {group.items.map((item) => {
                  renderIndex += 1;
                  const index = renderIndex;
                  const isActive = index === activeIndex;
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      id={`global-search-option-${item.id}`}
                      role="option"
                      aria-selected={isActive}
                      type="button"
                      onMouseEnter={() => setActiveIndex(index)}
                      onClick={() => goTo(item)}
                      className={clsx(
                        'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm',
                        isActive ? 'bg-slate-100 dark:bg-slate-800' : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'
                      )}
                    >
                      {item.avatar ? (
                        <Avatar src={item.avatar.profileImageUrl} name={item.label} size={28} />
                      ) : (
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                          {Icon && <Icon size={15} aria-hidden="true" />}
                        </span>
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium text-slate-800 dark:text-slate-100">{item.label}</span>
                        {item.meta && <span className="block truncate text-xs text-slate-500 dark:text-slate-400">{item.meta}</span>}
                      </span>
                      {item.status && <StatusBadge status={item.status} />}
                      {isActive && <CornerDownLeft size={14} className="hidden text-slate-400 sm:block" aria-hidden="true" />}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
