export default function StatCard({ label, value, icon: Icon, accent = 'indigo' }) {
  const accentClasses = {
    indigo: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400',
    emerald: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400',
    amber: 'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400',
    red: 'bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400',
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
        {Icon && (
          <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${accentClasses[accent]}`}>
            <Icon size={16} />
          </div>
        )}
      </div>
      <p className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">{value}</p>
    </div>
  );
}
