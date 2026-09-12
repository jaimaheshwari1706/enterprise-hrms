import { useCallback, useEffect, useRef, useState } from 'react';
import { Bell, CheckCheck, CalendarDays, Wallet, Users, Info } from 'lucide-react';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import { notificationApi } from '../api/notificationApi';
import { timeAgo } from '../utils/format';
import { isCancelledRequest } from '../utils/apiError';

const POLL_MS = 30000;
const TYPE_ICONS = { LEAVE: CalendarDays, PAYROLL: Wallet, EMPLOYEE: Users, GENERAL: Info };

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const containerRef = useRef(null);
  const controllerRef = useRef(null);

  const fetchNotifications = useCallback(() => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    notificationApi
      .list({ page: 1, limit: 8 }, { signal: controller.signal })
      .then(({ data }) => {
        setItems(data.data.items);
        setUnreadCount(data.data.unreadCount);
        setLoaded(true);
      })
      .catch((err) => {
        if (!isCancelledRequest(err)) setLoaded(true);
      });
  }, []);

  // Poll every 30s so the badge stays roughly current without needing
  // WebSockets — but only while the tab is visible; a background tab
  // shouldn't keep hitting the API.
  useEffect(() => {
    fetchNotifications();
    let interval = setInterval(fetchNotifications, POLL_MS);
    const onVisibility = () => {
      clearInterval(interval);
      if (document.visibilityState === 'visible') {
        fetchNotifications();
        interval = setInterval(fetchNotifications, POLL_MS);
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      clearInterval(interval);
      controllerRef.current?.abort();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [fetchNotifications]);

  useEffect(() => {
    if (!open) return undefined;
    const onClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const handleOpen = () => {
    setOpen((o) => !o);
    if (!open) fetchNotifications();
  };

  const handleItemClick = async (item) => {
    setOpen(false);
    if (item.isRead) return;
    setItems((prev) => prev.map((n) => (n._id === item._id ? { ...n, isRead: true } : n)));
    setUnreadCount((c) => Math.max(0, c - 1));
    try {
      await notificationApi.markRead(item._id);
    } catch {
      /* the next poll reconciles */
    }
  };

  const handleMarkAllRead = async () => {
    setItems((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);
    try {
      await notificationApi.markAllRead();
    } catch {
      fetchNotifications();
    }
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={handleOpen}
        aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="relative rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
      >
        <Bell size={18} aria-hidden="true" />
        {unreadCount > 0 && (
          <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white ring-2 ring-white dark:ring-slate-900">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Notifications"
          className="absolute right-0 z-50 mt-2 w-[calc(100vw-2rem)] max-w-sm origin-top-right animate-scale-in rounded-xl border border-slate-200 bg-white shadow-popover sm:w-96 dark:border-slate-700 dark:bg-slate-900"
        >
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-800">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Notifications</h3>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="flex items-center gap-1 rounded text-xs font-medium text-primary-600 hover:underline dark:text-primary-400"
              >
                <CheckCheck size={13} aria-hidden="true" /> Mark all read
              </button>
            )}
          </div>
          <div className="max-h-[60vh] overflow-y-auto">
            {!loaded ? (
              <p className="p-6 text-center text-sm text-slate-500 dark:text-slate-400">Loading…</p>
            ) : items.length === 0 ? (
              <div className="flex flex-col items-center gap-2 p-8 text-center">
                <Bell size={22} className="text-slate-300 dark:text-slate-600" aria-hidden="true" />
                <p className="text-sm font-medium text-slate-700 dark:text-slate-200">You're all caught up</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Leave decisions, payroll and approvals will show up here.</p>
              </div>
            ) : (
              <ul>
                {items.map((item) => {
                  const Icon = TYPE_ICONS[item.type] || Info;
                  return (
                    <li key={item._id}>
                      <Link
                        to={item.link || '#'}
                        onClick={() => handleItemClick(item)}
                        className={clsx(
                          'flex gap-3 border-b border-slate-100 px-4 py-3 text-sm transition-colors last:border-0 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/60',
                          !item.isRead && 'bg-primary-50/40 dark:bg-primary-500/5'
                        )}
                      >
                        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                          <Icon size={15} aria-hidden="true" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <p className={clsx('truncate', item.isRead ? 'text-slate-700 dark:text-slate-200' : 'font-medium text-slate-900 dark:text-white')}>{item.title}</p>
                            {!item.isRead && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary-500" aria-label="Unread" />}
                          </div>
                          <p className="line-clamp-2 text-xs text-slate-500 dark:text-slate-400">{item.message}</p>
                          <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">{timeAgo(item.createdAt)}</p>
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
