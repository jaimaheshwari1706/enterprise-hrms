import { useMemo, useState } from 'react';
import { CalendarDays, Plus, Trash2, Save } from 'lucide-react';
import { organizationApi } from '../../api/organizationApi';
import { useToast } from '../../hooks/useToast';
import { Button, Input, FormField, Card, CardHeader, IconButton, Alert, EmptyState } from '../../components/ui';
import { getApiErrorMessage } from '../../utils/apiError';
import { formatDate } from '../../utils/format';

const WEEKDAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function toInputDate(value) {
  return value ? String(value).slice(0, 10) : '';
}

// Public holidays. Edited as a list and saved as a whole (the organization
// endpoint replaces the list), grouped by year so a long list stays
// scannable. A holiday on a non-working weekday is flagged, because it will
// be skipped by leave counting anyway.
export default function HolidaysCard({ organization, onSaved }) {
  const { showToast } = useToast();
  const [holidays, setHolidays] = useState(() =>
    (organization.holidays || []).map((h) => ({ date: toInputDate(h.date), name: h.name }))
  );
  const [draft, setDraft] = useState({ date: '', name: '' });
  const [draftError, setDraftError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState(null);

  const original = useMemo(() => JSON.stringify((organization.holidays || []).map((h) => ({ date: toInputDate(h.date), name: h.name }))), [organization.holidays]);
  const dirty = JSON.stringify(holidays) !== original;
  const workingDays = organization.workingDays || [];

  const add = () => {
    setDraftError(null);
    if (!draft.date) return setDraftError('Pick a date');
    if (!draft.name.trim()) return setDraftError('Give the holiday a name');
    if (holidays.some((h) => h.date === draft.date)) return setDraftError('That date is already a holiday');
    setHolidays((prev) => [...prev, { date: draft.date, name: draft.name.trim() }].sort((a, b) => a.date.localeCompare(b.date)));
    setDraft({ date: '', name: '' });
  };

  const remove = (date) => setHolidays((prev) => prev.filter((h) => h.date !== date));

  const save = async () => {
    setSaving(true);
    setServerError(null);
    try {
      const { data } = await organizationApi.update({ name: organization.name, holidays });
      onSaved(data.data);
      showToast('Holidays saved');
    } catch (err) {
      setServerError(getApiErrorMessage(err, 'Unable to save holidays.'));
    } finally {
      setSaving(false);
    }
  };

  const byYear = useMemo(() => {
    const groups = new Map();
    for (const h of holidays) {
      const year = h.date.slice(0, 4);
      if (!groups.has(year)) groups.set(year, []);
      groups.get(year).push(h);
    }
    return [...groups.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [holidays]);

  return (
    <Card>
      <CardHeader
        title="Holidays"
        description="Public holidays are not counted as leave and are excluded from payable working days."
        actions={
          <Button size="sm" icon={Save} loading={saving} disabled={!dirty} onClick={save}>
            Save holidays
          </Button>
        }
      />
      <div className="space-y-4 p-5">
        {serverError && <Alert tone="danger">{serverError}</Alert>}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[180px_1fr_auto] sm:items-end">
          <FormField label="Date" error={draftError === 'Pick a date' || draftError === 'That date is already a holiday' ? draftError : undefined}>
            <Input type="date" value={draft.date} onChange={(e) => setDraft((d) => ({ ...d, date: e.target.value }))} />
          </FormField>
          <FormField label="Name" error={draftError === 'Give the holiday a name' ? draftError : undefined}>
            <Input
              placeholder="e.g. Independence Day"
              maxLength={80}
              value={draft.name}
              onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  add();
                }
              }}
            />
          </FormField>
          <Button variant="secondary" icon={Plus} onClick={add} className="sm:mb-0">
            Add
          </Button>
        </div>

        {holidays.length === 0 ? (
          <EmptyState compact icon={CalendarDays} title="No holidays configured" message="Add the public holidays your organization observes." />
        ) : (
          <div className="space-y-4">
            {byYear.map(([year, list]) => (
              <section key={year} aria-labelledby={`holidays-${year}`}>
                <h3 id={`holidays-${year}`} className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  {year} · {list.length} holiday{list.length === 1 ? '' : 's'}
                </h3>
                <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
                  {list.map((h) => {
                    const weekday = new Date(`${h.date}T00:00:00Z`).getUTCDay();
                    const onWeekend = workingDays.length > 0 && !workingDays.includes(['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][weekday]);
                    return (
                      <li key={h.date} className="flex items-center gap-3 px-3 py-2 text-sm">
                        <span className="w-28 shrink-0 tabular text-slate-600 dark:text-slate-300">
                          {formatDate(h.date)} <span className="text-xs text-slate-500 dark:text-slate-400">{WEEKDAY[weekday]}</span>
                        </span>
                        <span className="min-w-0 flex-1 truncate text-slate-900 dark:text-white">{h.name}</span>
                        {onWeekend && <span className="hidden text-xs text-slate-500 dark:text-slate-400 sm:inline">falls on a weekend</span>}
                        <IconButton label={`Remove ${h.name}`} icon={Trash2} tone="danger" size="sm" onClick={() => remove(h.date)} />
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}
