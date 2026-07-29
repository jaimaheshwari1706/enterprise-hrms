import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import { employeeApi } from '../api/employeeApi';
import Avatar from './Avatar';
import useDebounce from '../hooks/useDebounce';

export default function GlobalSearch() {
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounce(query, 300);
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (debouncedQuery.trim().length < 2) {
      setResults([]);
      return;
    }
    employeeApi.search(debouncedQuery).then(({ data }) => {
      setResults(data.data);
      setOpen(true);
    });
  }, [debouncedQuery]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const goTo = (employee) => {
    setOpen(false);
    setQuery('');
    navigate(`/employees/${employee._id}`);
  };

  return (
    <div className="relative w-full max-w-xs" ref={containerRef}>
      <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => query.trim().length >= 2 && setOpen(true)}
        placeholder="Search employees…"
        className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm outline-none focus:border-indigo-500 focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-white"
      />

      {open && (
        <div className="absolute left-0 right-0 z-50 mt-2 max-h-80 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg dark:border-slate-800 dark:bg-slate-900">
          {results.length === 0 ? (
            <p className="p-4 text-center text-sm text-slate-400">No employees found</p>
          ) : (
            results.map((emp) => (
              <button
                key={emp._id}
                onClick={() => goTo(emp)}
                className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                <Avatar src={emp.profileImageUrl} name={`${emp.firstName} ${emp.lastName}`} size={28} />
                <div>
                  <p className="font-medium text-slate-800 dark:text-slate-100">{emp.firstName} {emp.lastName}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {emp.employeeId} · {emp.department?.name || '—'}
                  </p>
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
