import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotifications } from '../context/NotificationContext';
import {
  Bell, CheckCheck, Loader2, ChevronDown, AlertTriangle,
  Package, X, ExternalLink, AlertOctagon, Users, Building2, Radio, Cpu,
} from 'lucide-react';

/* ─── Type metadata ──────────────────────────────────────────────────────────── */
const TYPE_META = {
  incident_status: {
    icon:  <AlertTriangle className="w-4 h-4 text-red-400" />,
    bg:    'bg-red-500/10 border-red-500/20',
    label: 'Incident',
  },
  assignment: {
    icon:  <Users className="w-4 h-4 text-blue-400" />,
    bg:    'bg-blue-500/10 border-blue-500/20',
    label: 'Assignment',
  },
  shelter: {
    icon:  <Building2 className="w-4 h-4 text-teal-400" />,
    bg:    'bg-teal-500/10 border-teal-500/20',
    label: 'Shelter',
  },
  alert: {
    icon:  <Radio className="w-4 h-4 text-orange-400" />,
    bg:    'bg-orange-500/10 border-orange-500/20',
    label: 'Alert',
  },
  system: {
    icon:  <Cpu className="w-4 h-4 text-zinc-400" />,
    bg:    'bg-zinc-500/10 border-zinc-500/20',
    label: 'System',
  },
  resource: {
    icon:  <Package className="w-4 h-4 text-purple-400" />,
    bg:    'bg-purple-500/10 border-purple-500/20',
    label: 'Resource',
  },
  sos: {
    icon:  <AlertOctagon className="w-4 h-4 text-red-400" />,
    bg:    'bg-red-500/15 border-red-500/20',
    label: 'SOS',
  },
};

const FILTER_TABS = [
  { key: 'all',            label: 'All' },
  { key: 'unread',         label: 'Unread' },
  { key: 'incident_status', label: 'Incidents' },
  { key: 'assignment',     label: 'Assignments' },
  { key: 'alert',          label: 'Alerts' },
  { key: 'shelter',        label: 'Shelter' },
  { key: 'resource',       label: 'Resources' },
  { key: 'sos',            label: 'SOS' },
  { key: 'system',         label: 'System' },
];

/* ─── Relative timestamp ─────────────────────────────────────────────────────── */
const timeAgo = (date) => {
  const secs = Math.floor((Date.now() - new Date(date)) / 1000);
  if (secs < 60)    return 'Just now';
  if (secs < 3600)  return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  const days = Math.floor(secs / 86400);
  if (days < 7) return `${days}d ago`;
  return new Date(date).toLocaleDateString('en', { day: 'numeric', month: 'short', year: 'numeric' });
};

/* ─── Single notification row ────────────────────────────────────────────────── */
const NotifRow = ({ notif, onMarkRead, onNavigate }) => {
  const meta = TYPE_META[notif.type] || TYPE_META.system;

  const handleClick = () => {
    if (!notif.read) onMarkRead(notif._id);
    if (notif.link) onNavigate(notif.link);
  };

  return (
    <div
      onClick={handleClick}
      className={`group flex items-start gap-4 p-4 rounded-2xl border transition-all cursor-pointer ${
        notif.read
          ? 'bg-zinc-900/50 border-zinc-800/50 hover:border-zinc-700 hover:bg-zinc-900'
          : 'bg-zinc-900 border-zinc-700 hover:border-zinc-600 shadow-sm'
      }`}
    >
      {/* Type icon */}
      <div className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${meta.bg}`}>
        {meta.icon}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className={`text-sm font-semibold leading-snug ${notif.read ? 'text-zinc-400' : 'text-zinc-100'}`}>
              {notif.title}
            </p>
            {notif.body && (
              <p className="text-xs text-zinc-500 mt-0.5 leading-relaxed line-clamp-2">{notif.body}</p>
            )}
            <div className="flex items-center gap-3 mt-1.5">
              <span className="text-[10px] font-bold text-zinc-600 uppercase">{meta.label}</span>
              <span className="text-[10px] text-zinc-600">{timeAgo(notif.createdAt)}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Unread dot */}
            {!notif.read && (
              <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0 mt-1" />
            )}
            {/* Navigate arrow (if link) */}
            {notif.link && (
              <ExternalLink className="w-3.5 h-3.5 text-zinc-600 group-hover:text-zinc-400 transition opacity-0 group-hover:opacity-100" />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

/* ─── Main page ──────────────────────────────────────────────────────────────── */
const PAGE_SIZE = 20;

const NotificationsPage = () => {
  const { notifications, unreadCount, loading, markRead, markAllRead, fetchNotifications } = useNotifications();
  const navigate = useNavigate();

  const [activeFilter, setActiveFilter]   = useState('all');
  const [visibleCount, setVisibleCount]   = useState(PAGE_SIZE);
  const [markingAll,   setMarkingAll]     = useState(false);

  /* Refresh when page mounts */
  useEffect(() => { fetchNotifications(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* Filter */
  const filtered = notifications.filter(n => {
    if (activeFilter === 'all')    return true;
    if (activeFilter === 'unread') return !n.read;
    return n.type === activeFilter;
  });

  const visible  = filtered.slice(0, visibleCount);
  const hasMore  = filtered.length > visibleCount;

  const handleMarkAll = useCallback(async () => {
    setMarkingAll(true);
    await markAllRead();
    setMarkingAll(false);
  }, [markAllRead]);

  /* Tab counts */
  const countFor = (key) => {
    if (key === 'all')    return notifications.length;
    if (key === 'unread') return unreadCount;
    return notifications.filter(n => n.type === key).length;
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">

        {/* Page header */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-9 h-9 rounded-xl bg-blue-600/20 border border-blue-600/30 flex items-center justify-center">
                <Bell className="w-4 h-4 text-blue-400" />
              </div>
              <h1 className="text-xl font-black text-zinc-100">Notifications</h1>
              {unreadCount > 0 && (
                <span className="text-xs font-bold px-2 py-0.5 bg-red-500/20 text-red-400 border border-red-500/30 rounded-full">
                  {unreadCount} new
                </span>
              )}
            </div>
            <p className="text-sm text-zinc-500">
              {notifications.length} total · stay informed about your incidents and updates
            </p>
          </div>

          {/* Mark all read */}
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAll}
              disabled={markingAll}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-zinc-300 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-xl transition disabled:opacity-60 shrink-0"
            >
              {markingAll
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : <CheckCheck className="w-3.5 h-3.5" />
              }
              Mark all read
            </button>
          )}
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
          {FILTER_TABS.map(tab => {
            const cnt     = countFor(tab.key);
            const isActive = activeFilter === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => { setActiveFilter(tab.key); setVisibleCount(PAGE_SIZE); }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap border transition-all ${
                  isActive
                    ? 'bg-blue-600 border-blue-500 text-white'
                    : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-600'
                }`}
              >
                {tab.label}
                {cnt > 0 && (
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                    isActive ? 'bg-white/20 text-white' : 'bg-zinc-700 text-zinc-400'
                  }`}>
                    {cnt}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Notification list */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 className="w-8 h-8 text-zinc-600 animate-spin" />
            <p className="text-sm text-zinc-500">Loading notifications…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center">
              <Bell className="w-7 h-7 text-zinc-700" />
            </div>
            <div className="text-center">
              <p className="text-base font-semibold text-zinc-400">
                {activeFilter === 'unread' ? 'All caught up!' : 'No notifications yet'}
              </p>
              <p className="text-sm text-zinc-600 mt-1">
                {activeFilter === 'unread'
                  ? 'You have no unread notifications.'
                  : 'Notifications about incidents, assignments, and updates will appear here.'}
              </p>
            </div>
            {activeFilter !== 'all' && (
              <button
                onClick={() => setActiveFilter('all')}
                className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition"
              >
                <X className="w-3.5 h-3.5" /> Clear filter
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {visible.map(notif => (
              <NotifRow
                key={notif._id}
                notif={notif}
                onMarkRead={markRead}
                onNavigate={navigate}
              />
            ))}

            {/* Load more */}
            {hasMore && (
              <button
                onClick={() => setVisibleCount(c => c + PAGE_SIZE)}
                className="w-full flex items-center justify-center gap-2 py-3 text-sm font-semibold text-zinc-400 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-2xl transition"
              >
                <ChevronDown className="w-4 h-4" />
                Load more ({filtered.length - visibleCount} remaining)
              </button>
            )}

            {/* End of list */}
            {!hasMore && filtered.length > PAGE_SIZE && (
              <p className="text-center text-xs text-zinc-700 py-2">You've seen all notifications</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default NotificationsPage;
