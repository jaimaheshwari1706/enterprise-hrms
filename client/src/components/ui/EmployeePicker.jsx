import { useEffect, useId, useRef, useState } from 'react';
import { Search, X, Loader2 } from 'lucide-react';
import clsx from 'clsx';
import { employeeApi } from '../../api/employeeApi';
import useDebounce from '../../hooks/useDebounce';
import { isCancelledRequest } from '../../utils/apiError';
import { fullName } from '../../utils/format';
import Avatar from './Avatar';

// Searchable employee selector (combobox + listbox). Searches server-side
// through GET /employees/search — role-scoped, capped at a handful of
// results — so a 5,000-person directory never has to be downloaded to fill
// a dropdown. Keyboard: type to search, ↑/↓ to move, Enter to pick, Esc to
// close, Backspace on an empty box clears the selection.
//
//   <EmployeePicker value={id} selected={employeeObj} onChange={(id, employee) => …} />
//
// `selected` lets the caller render the chosen person immediately (e.g. an
// edit form that already has the manager populated); it is optional —
// when only `value` is known the picker shows the id until a search
// selects someone.
export default function EmployeePicker({
  value = '',
  selected = null,
  onChange,
  placeholder = 'Search by name or ID…',
  emptyLabel = 'Anyone',
  exclude = [],
  disabled = false,
  className = '',
  id: idProp,
  'aria-label': ariaLabel,
  'aria-describedby': describedBy,
  invalid,
}) {
  const generatedId = useId();
  const id = idProp || generatedId;
  const [query, setQuery] = useState('');
  const debounced = useDebounce(query, 250);
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [chosen, setChosen] = useState(selected);
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  // Keep the chip in sync when the parent resets the value / selection.
  // A value with no accompanying object (e.g. an id read from the URL) is
  // resolved with one lookup so the chip can show a name, not an id.
  useEffect(() => {
    if (!value) {
      setChosen(null);
      return undefined;
    }
    if (selected && (selected._id === value || selected.id === value)) {
      setChosen(selected);
      return undefined;
    }
    if (chosen && chosen._id === value) return undefined;
    const controller = new AbortController();
    employeeApi
      .get(value, { signal: controller.signal })
      .then(({ data }) => setChosen(data.data))
      .catch(() => {});
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, selected]);

  useEffect(() => {
    if (debounced.trim().length < 2) {
      setResults([]);
      setLoading(false);
      return undefined;
    }
    const controller = new AbortController();
    setLoading(true);
    employeeApi
      .search(debounced, { signal: controller.signal })
      .then(({ data }) => {
        setResults((data.data || []).filter((e) => !exclude.includes(e._id)));
        setActiveIndex(0);
        setOpen(true);
      })
      .catch((err) => {
        if (!isCancelledRequest(err)) setResults([]);
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);

  useEffect(() => {
    const onClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const pick = (employee) => {
    setChosen(employee);
    setQuery('');
    setResults([]);
    setOpen(false);
    onChange?.(employee._id, employee);
  };

  const clear = () => {
    setChosen(null);
    setQuery('');
    setResults([]);
    onChange?.('', null);
    inputRef.current?.focus();
  };

  const onKeyDown = (e) => {
    if (e.key === 'Backspace' && !query && chosen) {
      clear();
      return;
    }
    if (e.key === 'Escape') {
      setOpen(false);
      return;
    }
    if (!open || results.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % results.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => (i - 1 + results.length) % results.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      pick(results[activeIndex]);
    }
  };

  const showPanel = open && query.trim().length >= 2;
  const listId = `${id}-listbox`;

  return (
    <div ref={containerRef} className={clsx('relative', className)}>
      <div
        className={clsx(
          'ui-input flex min-h-[38px] items-center gap-2 py-1 pl-2.5 pr-2',
          disabled && 'cursor-not-allowed bg-slate-50 dark:bg-slate-800/60'
        )}
        aria-invalid={invalid || undefined}
        onClick={() => inputRef.current?.focus()}
      >
        {chosen ? (
          <span className="flex min-w-0 items-center gap-2 rounded-md bg-slate-100 py-0.5 pl-1 pr-1.5 text-sm dark:bg-slate-800">
            <Avatar src={chosen.profileImageUrl} name={fullName(chosen)} size={20} />
            <span className="truncate text-slate-800 dark:text-slate-100">{fullName(chosen)}</span>
            {chosen.employeeId && <span className="hidden font-mono text-xs text-slate-500 sm:inline">{chosen.employeeId}</span>}
            {!disabled && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  clear();
                }}
                aria-label={`Clear ${fullName(chosen)}`}
                className="rounded p-0.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700 dark:hover:bg-slate-700 dark:hover:text-white"
              >
                <X size={12} aria-hidden="true" />
              </button>
            )}
          </span>
        ) : (
          <Search size={15} className="shrink-0 text-slate-400" aria-hidden="true" />
        )}
        <input
          ref={inputRef}
          id={id}
          type="text"
          role="combobox"
          aria-expanded={showPanel}
          aria-controls={showPanel ? listId : undefined}
          aria-autocomplete="list"
          aria-activedescendant={showPanel && results[activeIndex] ? `${id}-option-${results[activeIndex]._id}` : undefined}
          aria-label={ariaLabel}
          aria-describedby={describedBy}
          autoComplete="off"
          disabled={disabled}
          value={query}
          placeholder={chosen ? '' : value ? 'Loading…' : `${emptyLabel} — ${placeholder}`}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => query.trim().length >= 2 && setOpen(true)}
          onKeyDown={onKeyDown}
          className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400 disabled:cursor-not-allowed"
        />
        {loading && <Loader2 size={14} className="shrink-0 animate-spin text-slate-400" aria-hidden="true" />}
      </div>

      {showPanel && (
        <ul
          id={listId}
          role="listbox"
          aria-label="Matching employees"
          className="absolute left-0 right-0 z-40 mt-1 max-h-64 overflow-y-auto rounded-lg border border-slate-200 bg-white p-1 shadow-popover dark:border-slate-700 dark:bg-slate-900"
        >
          {results.length === 0 ? (
            <li className="px-3 py-2 text-sm text-slate-500 dark:text-slate-400" role="option" aria-selected={false} aria-disabled="true">
              {loading ? 'Searching…' : 'No employees found'}
            </li>
          ) : (
            results.map((emp, index) => (
              <li
                key={emp._id}
                id={`${id}-option-${emp._id}`}
                role="option"
                aria-selected={index === activeIndex}
                onMouseEnter={() => setActiveIndex(index)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(emp)}
                className={clsx(
                  'flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm',
                  index === activeIndex ? 'bg-slate-100 dark:bg-slate-800' : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'
                )}
              >
                <Avatar src={emp.profileImageUrl} name={fullName(emp)} size={24} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-slate-800 dark:text-slate-100">{fullName(emp)}</span>
                  <span className="block truncate text-xs text-slate-500 dark:text-slate-400">
                    {[emp.employeeId, emp.designation?.name, emp.department?.name].filter(Boolean).join(' · ')}
                  </span>
                </span>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
