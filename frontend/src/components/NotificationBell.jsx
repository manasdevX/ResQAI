import { useEffect, useRef } from 'react';
import { Bell, X, CheckCheck, Loader2, ExternalLink } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useNotifications } from '../context/NotificationContext';

const TYPE_META = {
  incident_status: { icon: '🚨', color: 'text-red-400',    bg: 'bg-red-500/10'    },
  assignment:      { icon: '👤', color: 'text-blue-400',   bg: 'bg-blue-500/10'   },
  shelter:         { icon: '🏠', color: 'text-teal-400',   bg: 'bg-teal-500/10'   },
  alert:           { icon: '📡', color: 'text-orange-400', bg: 'bg-orange-500/10' },
  system:          { icon: '🔔', color: 'text-zinc-400',   bg: 'bg-zinc-500/10'   },
  resource:        { icon: '📦', color: 'text-purple-400', bg: 'bg-purple-500/10' },
  sos:             { icon: '🆘', color: 'text-red-400',    bg: 'bg-red-500/15'    },
};

const timeAgo = (date) => {
  const secs = Math.floor((Date.now() - new Date(date)) / 1000);
  if (secs < 60)    return 'Just now';
  if (secs < 3600)  return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return new Date(date).toLocaleDateString('en', { day: 'numeric', month: 'short' });
};

const NotificationBell = () => {
  const { notifications, unreadCount, loading, open, setOpen, markRead, markAllRead } = useNotifications();
  const panelRef = useRef(null);
  const navigate = useNavigate();

  // Close on outside click or Escape
  useEffect(() => {
    if (!open) return;
    const onMouseDown = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false);
    };
    const onKeyDown = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown',   onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown',   onKeyDown);
    };
  }, [open, setOpen]);

  const handleNotifClick = (n) => {
    if (!n.read) markRead(n._id);
    if (n.link) {
      setOpen(false);
      navigate(n.link);
    }
  };

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell button */}
      <button
        onClick={() => setOpen(o => !o)}
        className={`relative p-2 rounded-xl text-zinc-400 hover:text-zinc-100 transition-all duration-200 ${
          open ? 'bg-zinc-800 text-zinc-100' : 'hover:bg-zinc-800/80'
        }`}
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
      >
        <Bell className={`w-4 h-4 transition-all ${open ? 'scale-110' : ''}`} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-0.5 flex items-center justify-center bg-red-500 text-white text-[9px] font-black rounded-full leading-none animate-badge-pop shadow-sm shadow-red-500/50">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute right-0 top-full mt-2.5 w-80 sm:w-96 bg-zinc-900 border border-zinc-700/80 rounded-2xl shadow-2xl shadow-black/60 z-50 overflow-hidden animate-scale-in">

          {/* Gradient top line */}
          <div className="h-px w-full bg-gradient-to-r from-blue-600/0 via-blue-500/60 to-blue-600/0" />

          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800/80">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-blue-600/20 flex items-center justify-center">
                <Bell className="w-3.5 h-3.5 text-blue-400" />
              </div>
              <span className="text-sm font-bold text-zinc-100">Notifications</span>
              {unreadCount > 0 && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 bg-red-500/20 text-red-400 border border-red-500/30 rounded-full">
                  {unreadCount} new
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  className="flex items-center gap-1 text-[11px] text-zinc-400 hover:text-zinc-100 px-2 py-1 rounded-lg hover:bg-zinc-800 transition-all"
                  title="Mark all as read"
                >
                  <CheckCheck className="w-3.5 h-3.5" /> All read
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="p-1.5 text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 rounded-lg transition-all"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Notifications list */}
          <div className="max-h-[400px] overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-5 h-5 text-zinc-500 animate-spin" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="py-14 text-center text-zinc-500">
                <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center mx-auto mb-3">
                  <Bell className="w-5 h-5 opacity-40" />
                </div>
                <p className="text-sm font-medium text-zinc-400">All caught up!</p>
                <p className="text-xs mt-1 text-zinc-600">No notifications yet</p>
              </div>
            ) : (
              <div className="divide-y divide-zinc-800/60">
                {notifications.map(n => {
                  const meta = TYPE_META[n.type] || TYPE_META.system;
                  return (
                    <button
                      key={n._id}
                      onClick={() => handleNotifClick(n)}
                      className={`w-full text-left px-4 py-3 flex items-start gap-3 transition-all hover:bg-zinc-800/50 ${
                        !n.read ? 'bg-blue-950/10' : ''
                      }`}
                    >
                      {/* Icon */}
                      <span className={`w-8 h-8 rounded-lg ${meta.bg} flex items-center justify-center text-base shrink-0 mt-0.5`}>
                        {meta.icon}
                      </span>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className={`text-xs font-semibold leading-snug ${n.read ? 'text-zinc-400' : 'text-zinc-100'}`}>
                            {n.title}
                          </p>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {!n.read && <span className="w-1.5 h-1.5 bg-blue-500 rounded-full shrink-0 mt-1" />}
                            {n.link && <ExternalLink className="w-2.5 h-2.5 text-zinc-600" />}
                          </div>
                        </div>
                        {n.body && (
                          <p className="text-[11px] text-zinc-500 mt-0.5 leading-relaxed line-clamp-2">{n.body}</p>
                        )}
                        <p className={`text-[10px] mt-1 font-medium ${meta.color} opacity-70`}>{timeAgo(n.createdAt)}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-2.5 border-t border-zinc-800/80 bg-zinc-900/80">
            <Link
              to="/notifications"
              onClick={() => setOpen(false)}
              className="flex items-center justify-center gap-1.5 text-xs text-zinc-500 hover:text-blue-400 transition-colors font-medium py-0.5"
            >
              View all notifications
              <ExternalLink className="w-3 h-3" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
