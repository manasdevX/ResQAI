import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import {
  LayoutDashboard, AlertTriangle, Building2, Radio, BarChart3,
  Link2, MessageCircle, Users, User, LogOut, ChevronRight,
  Shield, Menu, X,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import NotificationBell from '../components/NotificationBell';

const NAV_SECTIONS = [
  {
    title: 'Operations',
    items: [
      { to: '/admin',           icon: LayoutDashboard, label: 'Operations Map',   exact: true  },
      { to: '/admin/incidents', icon: AlertTriangle,   label: 'Incidents',        exact: false },
      { to: '/admin/alerts',    icon: Radio,           label: 'Broadcast Alerts', exact: false },
    ],
  },
  {
    title: 'Management',
    items: [
      { to: '/admin/shelters',  icon: Building2,       label: 'Shelters',         exact: false },
      { to: '/admin/users',     icon: Users,           label: 'Users',            exact: false },
      { to: '/admin/analytics', icon: BarChart3,       label: 'Analytics',        exact: false },
      { to: '/admin/invites',   icon: Link2,           label: 'Invite Links',     exact: false },
    ],
  },
  {
    title: 'Tools',
    items: [
      { to: '/admin/chat',    icon: MessageCircle, label: 'Chat',    exact: false },
      { to: '/admin/profile', icon: User,          label: 'Profile', exact: false },
    ],
  },
];

const NavItem = ({ to, icon: Icon, label, exact }) => (
  <NavLink
    to={to}
    end={exact}
    className={({ isActive }) =>
      `group flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm transition-all duration-200 relative ${
        isActive
          ? 'bg-red-600/15 text-red-400 font-semibold'
          : 'text-zinc-400 hover:bg-zinc-800/80 hover:text-zinc-100 font-medium'
      }`
    }
  >
    {({ isActive }) => (
      <>
        {isActive && (
          <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-red-400 rounded-r-full" />
        )}
        <Icon className="w-4 h-4 shrink-0" />
        <span className="flex-1 truncate">{label}</span>
        {isActive && <ChevronRight className="w-3 h-3 opacity-50 shrink-0" />}
      </>
    )}
  </NavLink>
);

const AdminSidebar = ({ user, onLogout }) => (
  <>
    {/* Logo */}
    <div className="px-4 pt-4 pb-3 border-b border-zinc-800/60">
      <div className="flex items-center gap-2.5">
        <div className="relative w-9 h-9 rounded-xl bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center shadow-lg shadow-red-600/40">
          <Shield className="w-[18px] h-[18px] text-white" />
        </div>
        <div>
          <p className="text-sm font-black text-zinc-100 tracking-tight">
            ResQ<span className="text-red-400">AI</span>
          </p>
          <p className="text-[9px] text-zinc-500 mt-0.5 font-semibold uppercase tracking-widest">Operations Center</p>
        </div>
      </div>

      {/* Admin status indicator */}
      <div className="mt-3 flex items-center gap-2 px-2.5 py-1.5 bg-red-950/25 border border-red-800/25 rounded-lg">
        <span className="relative flex h-1.5 w-1.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500" />
        </span>
        <span className="text-[10px] text-red-400 font-bold uppercase tracking-widest">Admin Access</span>
      </div>
    </div>

    {/* Nav sections */}
    <nav className="flex-1 py-4 px-2 space-y-4 overflow-y-auto">
      {NAV_SECTIONS.map(({ title, items }) => (
        <div key={title}>
          <div className="flex items-center gap-2 px-3 mb-1.5">
            <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">{title}</span>
            <div className="flex-1 h-px bg-zinc-800/60" />
          </div>
          <div className="space-y-0.5">
            {items.map(item => <NavItem key={item.to} {...item} />)}
          </div>
        </div>
      ))}
    </nav>

    {/* User footer */}
    <div className="p-3 border-t border-zinc-800/60">
      <div className="flex items-center gap-2.5 mb-2.5 px-1">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center text-xs font-black text-white shadow-sm shrink-0 overflow-hidden">
          {user?.avatar
            ? <img src={user.avatar} alt="" className="w-full h-full rounded-full object-cover" referrerPolicy="no-referrer" />
            : user?.name?.[0]?.toUpperCase() || 'A'
          }
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold text-zinc-200 truncate">{user?.name}</p>
          <p className="text-[10px] text-red-400 font-semibold uppercase tracking-wider truncate">Administrator</p>
        </div>
        <NotificationBell />
      </div>
      <button
        onClick={onLogout}
        className="w-full flex items-center justify-center gap-2 py-2 text-xs font-semibold text-zinc-400 hover:text-red-400 hover:bg-red-950/25 border border-zinc-800/80 hover:border-red-800/40 rounded-xl transition-all duration-200"
      >
        <LogOut className="w-3.5 h-3.5" /> Sign Out
      </button>
    </div>
  </>
);

const AdminLayout = () => {
  const { user, logout } = useAuth();
  const socket           = useSocket();
  const navigate         = useNavigate();
  const location         = useLocation();
  const [mobileOpen,      setMobileOpen]      = useState(false);
  const [broadcastAlert,  setBroadcastAlert]  = useState(null);

  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  useEffect(() => {
    if (!socket) return;
    const onBroadcast = (alert) => {
      setBroadcastAlert(alert);
      setTimeout(() => setBroadcastAlert(null), 15000);
    };
    socket.on('alertBroadcast', onBroadcast);
    return () => socket.off('alertBroadcast', onBroadcast);
  }, [socket]);

  const handleLogout = () => { logout(); navigate('/login'); };

  return (
    <div className="flex h-screen bg-zinc-950 text-zinc-100 overflow-hidden">

      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-[220px] shrink-0 bg-zinc-900/98 border-r border-zinc-800/60 flex-col overflow-hidden">
        <AdminSidebar user={user} onLogout={handleLogout} />
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 z-50 bg-black/70 backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
        >
          <aside
            className="w-64 h-full bg-zinc-900 border-r border-zinc-800 flex flex-col overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <AdminSidebar user={user} onLogout={handleLogout} />
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile top bar */}
        <div className="md:hidden flex items-center gap-3 px-4 py-3 bg-zinc-900/95 backdrop-blur-xl border-b border-zinc-800/60 shrink-0">
          <button
            onClick={() => setMobileOpen(true)}
            className="p-2 rounded-xl hover:bg-zinc-800/80 border border-transparent hover:border-zinc-700/50 transition-all"
          >
            <Menu className="w-5 h-5 text-zinc-400" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center shadow-sm shadow-red-600/30">
              <Shield className="w-3 h-3 text-white" />
            </div>
            <span className="font-black text-sm tracking-tight">
              ResQ<span className="text-red-400">AI</span>
            </span>
            <span className="text-[10px] text-zinc-600 font-medium">Admin</span>
          </div>
          <div className="ml-auto">
            <NotificationBell />
          </div>
        </div>

        {/* Broadcast alert banner — visible on every admin page */}
        {broadcastAlert && (
          <div className={`shrink-0 flex items-start gap-3 px-5 py-3 text-sm font-medium border-b animate-pulse ${
            broadcastAlert.alertType === 'evacuation' ? 'bg-red-950/90 border-red-800/60 text-red-100' :
            broadcastAlert.alertType === 'medical'    ? 'bg-orange-950/90 border-orange-800/60 text-orange-100' :
            broadcastAlert.alertType === 'shelter'    ? 'bg-blue-950/90 border-blue-800/60 text-blue-100' :
            'bg-zinc-800/90 border-zinc-700/60 text-zinc-100'
          }`}>
            <span className="text-xl shrink-0">
              {broadcastAlert.alertType === 'evacuation' ? '🚨' :
               broadcastAlert.alertType === 'medical'    ? '🚑' :
               broadcastAlert.alertType === 'shelter'    ? '🏠' : '📢'}
            </span>
            <div className="flex-1 min-w-0">
              <span className="font-black uppercase text-xs tracking-wider opacity-80 mr-2">
                {broadcastAlert.alertType} Alert
              </span>
              {broadcastAlert.message}
              <span className="ml-2 text-xs opacity-50">— {broadcastAlert.broadcastBy}</span>
            </div>
            <button onClick={() => setBroadcastAlert(null)} className="shrink-0 opacity-60 hover:opacity-100 transition-opacity p-1" aria-label="Dismiss">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Main content area wrapped with a location-based key to ensure immediate route switching */}
        <main key={location.pathname} className="flex-1 overflow-hidden flex flex-col">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
