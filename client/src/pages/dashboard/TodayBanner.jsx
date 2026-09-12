import { CalendarOff } from 'lucide-react';
import { Alert } from '../../components/ui';

// One line explaining why attendance figures look quiet today (weekend or
// holiday, per the organization calendar). Renders nothing on a working day.
export default function TodayBanner({ today, className = 'mb-5' }) {
  if (!today || today.working) return null;
  return (
    <Alert tone="info" className={className}>
      <span className="inline-flex items-center gap-2">
        <CalendarOff size={15} aria-hidden="true" />
        {today.holiday ? `Today is a holiday (${today.holiday}).` : `Today (${today.weekday}) is not a working day.`} Nobody is counted as absent.
      </span>
    </Alert>
  );
}
