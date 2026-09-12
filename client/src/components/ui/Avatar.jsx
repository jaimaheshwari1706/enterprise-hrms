import clsx from 'clsx';

// Deterministic background per name so the same person always gets the
// same colour across tables, headers and lists.
const PALETTE = [
  'bg-primary-100 text-primary-700 dark:bg-primary-500/20 dark:text-primary-200',
  'bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-200',
  'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200',
  'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-200',
  'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-200',
  'bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-200',
];

function hashName(name = '') {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return hash;
}

export default function Avatar({ src, name, size = 36, className = '' }) {
  const initials = name
    ? name
        .trim()
        .split(/\s+/)
        .map((p) => p[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : '?';

  if (src) {
    return (
      <img
        src={src}
        alt={name || ''}
        width={size}
        height={size}
        loading="lazy"
        style={{ width: size, height: size }}
        className={clsx('shrink-0 rounded-full object-cover ring-1 ring-slate-200 dark:ring-slate-700', className)}
      />
    );
  }

  return (
    <div
      role="img"
      aria-label={name || 'Unknown'}
      style={{ width: size, height: size, fontSize: Math.max(10, size * 0.38) }}
      className={clsx('flex shrink-0 select-none items-center justify-center rounded-full font-semibold', PALETTE[hashName(name) % PALETTE.length], className)}
    >
      {initials}
    </div>
  );
}
