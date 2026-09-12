import { Search, X } from 'lucide-react';
import Input from './Input';

export default function SearchInput({ value, onChange, placeholder = 'Search…', className = '', ...props }) {
  return (
    <div className={`relative ${className}`}>
      <Input type="search" leftIcon={Search} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={placeholder} className="pr-8 [&::-webkit-search-cancel-button]:hidden" {...props} />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label="Clear search"
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
        >
          <X size={14} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
