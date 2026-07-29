import { useEffect, useRef, useState } from 'react';
import { Bell, CheckCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { notificationApi } from '../api/notificationApi';

function timeAgo(value) {
  const seconds = Math.floor((Date.now() - new Date(value).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const containerRef = useRef(null);

  const fetchNotifications = () => {
    notificationApi.list({ page: 1, limit: 8 }).then(({ data }) => {
      setItems(data.data.items);
      setUnreadCount(data.data.unreadCount);
    });
  };

  // Poll every 30s so the badge stays roughly current without needing
  // WebSockets — matches the "normal API-based notifications" scope.
  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleOpen = () => {
    setOpen((o) => !o);
    if (!open) fetchNotifications();
  };

  const handleItemClick = async (item) => {
    if (!item.isRead) {
      await notificationApi.markRead(item._id);
      setItems((prev) => prev.map((n) => (n._id === item._id ? { ...n, isRead: true } : n)));
      setUnreadCount((c) => Math.max(0, c - 1));
    }
  };

  const handleMarkAllRead = async () => {
    await notificationApi.markAllRead();
    setItems((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={handleOpen}
        className="relative rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-medium text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-80 rounded-xl border border-slate-200 bg-white shadow-lg dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-800">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Notifications</h3>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="flex items-center gap-1 text-xs text-indigo-600 hover:underline dark:text-indigo-400"
              >
                <CheckCheck size={13} /> Mark all read
              </button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {items.length === 0 ? (
              <p className="p-6 text-center text-sm text-slate-400">No notifications yet</p>
            ) : (
              items.map((item) => (
                <Link
                  key={item._id}
                  to={item.link || '#'}
                  onClick={() => handleItemClick(item)}
                  className={`block border-b border-slate-100 px-4 py-3 text-sm last:border-0 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800 ${
                    !item.isRead ? 'bg-indigo-50/50 dark:bg-indigo-500/5' : ''
                  }`}
                >
                  <p className="font-medium text-slate-800 dark:text-slate-100">{item.title}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{item.message}</p>
                  <p className="mt-1 text-[11px] text-slate-400">{timeAgo(item.createdAt)}</p>
                </Link>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
