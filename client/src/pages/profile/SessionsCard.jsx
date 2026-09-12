import { useState } from 'react';
import { useDispatch } from 'react-redux';
import { LogOut, MonitorSmartphone, X } from 'lucide-react';
import { authApi } from '../../api/authApi';
import { logout } from '../../features/auth/authSlice';
import { useApiQuery } from '../../hooks/useApiQuery';
import { useToast } from '../../hooks/useToast';
import { Button, Card, CardHeader, ConfirmDialog, Badge, IconButton, ErrorState, Skeleton } from '../../components/ui';
import { getApiErrorMessage } from '../../utils/apiError';
import { formatDateTime, timeAgo } from '../../utils/format';
import { describeUserAgent } from '../../utils/userAgent';

export default function SessionsCard() {
  const dispatch = useDispatch();
  const { showToast } = useToast();
  const sessions = useApiQuery((signal) => authApi.sessions({ signal }), []);
  const [confirmAll, setConfirmAll] = useState(false);
  const [busy, setBusy] = useState(null); // session id or 'all'

  const revoke = async (session) => {
    setBusy(session.id);
    try {
      const { data } = await authApi.revokeSession(session.id);
      if (data.data.current) {
        dispatch(logout());
        return;
      }
      sessions.setData((prev) => (prev || []).filter((s) => s.id !== session.id));
      showToast('Session signed out');
    } catch (err) {
      showToast(getApiErrorMessage(err, 'Unable to revoke that session.'), 'error');
    } finally {
      setBusy(null);
    }
  };

  const signOutEverywhere = async () => {
    setBusy('all');
    try {
      await authApi.logoutAll();
    } catch {
      // Even if the call fails the local session is cleared below; the
      // server-side tokens are then invalid or the user retries.
    } finally {
      setBusy(null);
      setConfirmAll(false);
      dispatch(logout());
    }
  };

  const rows = sessions.data || [];

  return (
    <Card>
      <CardHeader
        title="Active sessions"
        description="Devices currently signed in to your account. Sign out any you don't recognise."
        actions={
          <Button variant="secondary" size="sm" icon={LogOut} onClick={() => setConfirmAll(true)} disabled={sessions.status !== 'ready'}>
            Sign out everywhere
          </Button>
        }
      />
      {sessions.status === 'loading' ? (
        <div className="space-y-3 p-5" role="status" aria-label="Loading sessions">
          <Skeleton className="h-10" />
          <Skeleton className="h-10" />
        </div>
      ) : sessions.status === 'error' ? (
        <ErrorState compact message={sessions.error} onRetry={sessions.refetch} />
      ) : (
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {rows.map((session) => (
            <li key={session.id} className="flex items-center gap-3 px-5 py-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                <MonitorSmartphone size={18} aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-sm font-medium text-slate-900 dark:text-white">{describeUserAgent(session.userAgent)}</p>
                  {session.current && <Badge tone="success">This device</Badge>}
                </div>
                <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                  {session.ip ? `${session.ip} · ` : ''}
                  signed in {formatDateTime(session.createdAt)} · active {timeAgo(session.lastActiveAt)}
                </p>
              </div>
              <IconButton
                label={session.current ? 'Sign out of this device' : `Sign out ${describeUserAgent(session.userAgent)}`}
                icon={X}
                tone="danger"
                loading={busy === session.id}
                onClick={() => revoke(session)}
              />
            </li>
          ))}
          {rows.length === 0 && <li className="px-5 py-6 text-center text-sm text-slate-500">No active sessions.</li>}
        </ul>
      )}

      <ConfirmDialog
        open={confirmAll}
        onClose={() => setConfirmAll(false)}
        onConfirm={signOutEverywhere}
        loading={busy === 'all'}
        tone="danger"
        title="Sign out everywhere?"
        message="Every device signed in to your account — including this one — will be signed out immediately. You'll need to log in again."
        confirmLabel="Sign out everywhere"
      />
    </Card>
  );
}
