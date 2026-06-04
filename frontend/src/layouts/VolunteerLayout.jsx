import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import {
  LayoutDashboard, MapPin, ClipboardList, Package,
  MessageCircle, User, LogOut, Zap, Bell,
  ChevronRight, Activity, Menu, X,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import NotificationBell from '../components/NotificationBell';

const NAV_RESPONDER = [
  { to: '/volunteer',              icon: LayoutDashboard, label: 'Dashboard',         exact: true  },
  { to: '/volunteer/incidents',    icon: MapPin,          label: 'Nearby Incidents',  exact: false },
  { to: '/volunteer/assignments',  icon: ClipboardList,   label: 'My Assignments',    exact: false },
  { to: '/volunteer/resources',    icon: Package,         label: 'Resource Requests', exact: false },
  { to: '/notifications',          icon: Bell,            label: 'Notifications',     exact: false },
  { to: '/volunteer/chat',         icon: MessageCircle,   label: 'Chat',              exact: false },
  { to: '/volunteer/profile',      icon: User,            label: 'Profile',           exact: false },
];

const VolunteerSidebar = ({ nav, user, toggling, onToggleAvailability, onLogout }) => {
  const navLinkClass = ({ isActive }) =>
    `group flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm transition-all duration-200 relative ${
      isActive
        ? 'bg-blue-600/15 text-blue-400 font-semibold'
        : 'text-zinc-400 hover:bg-zinc-800/80 hover:text-zinc-100 font-medium'
    }`;

  return (
    <>
      {/* Logo */}
      <div className="px-4 pt-4 pb-3 border-b border-zinc-800/60">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center font-black text-sm shadow-lg bg-gradient-to-br from-blue-500 to-blue-700 shadow-blue-600/40">
            <Activity className="w-[18px] h-[18px] text-white" />
          </div>
          <div>
            <p className="text-sm font-black text-zinc-100 tracking-tight">
              ResQ<span className="text-blue-400">AI</span>
            </p>
            <p className="text-[9px] text-zinc-500 mt-0.5 font-semibold uppercase tracking-widest">
              Responder Portal
            </p>
          </div>
        </div>
      </div>

      {/* Availability toggle */}
      {(
        <div className="px-3 py-3 border-b border-zinc-800/60">
          <button
            onClick={onToggleAvailability}
            disabled={toggling}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl border text-sm font-semibold transition-all duration-300 ${
              user?.isAvailable
                ? 'bg-green-500/12 border-green-500/25 text-green-400 hover:bg-green-500/20 shadow-sm shadow-green-500/10'
                : 'bg-zinc-800/60 border-zinc-700/60 text-zinc-400 hover:bg-zinc-700/60 hover:text-zinc-300'
            }`}
          >
            <span className="flex items-center gap-2.5">
              {user?.isAvailable ? (
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-60" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
                </span>
              ) : (
                <span className="w-2.5 h-2.5 rounded-full bg-zinc-600" />
              )}
              {user?.isAvailable ? 'ON DUTY' : 'OFF DUTY'}
            </span>
            <Zap className={`w-3.5 h-3.5 ${toggling ? 'animate-spin text-yellow-400' : ''}`} />
          </button>
        </div>
      )}

      {/* Nav links */}
      <nav className="flex-1 py-4 px-2 overflow-y-auto">
        <div className="flex items-center gap-2 px-3 mb-2">
          <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">Navigation</span>
          <div className="flex-1 h-px bg-zinc-800/60" />
        </div>
        <div className="space-y-0.5">
          {nav.map(({ to, icon: Icon, label, exact }) => (
            <NavLink key={to} to={to} end={exact} className={navLinkClass}>
              {({ isActive }) => (
                <>
                  {isActive && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 rounded-r-full bg-blue-400" />
                  )}
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="flex-1 truncate">{label}</span>
                  {isActive && <ChevronRight className="w-3 h-3 opacity-50 shrink-0" />}
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>

      {/* User footer */}
      <div className="p-3 border-t border-zinc-800/60">
        <div className="flex items-center gap-2.5 mb-2.5 px-1">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br overflow-hidden from-blue-500 to-blue-700 flex items-center justify-center text-xs font-black text-white shadow-sm shrink-0">
            {user?.avatar
              ? <img src={user.avatar} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              : user?.name?.[0]?.toUpperCase() || 'V'
            }
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-zinc-200 truncate">{user?.name}</p>
            <p className="text-[10px] capitalize truncate font-medium text-blue-400">
              {user?.role?.replace('_', ' ')}
            </p>
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
};

const VolunteerLayout = () => {
  const { user, api, logout, updateUser } = useAuth();
  const socket    = useSocket();
  const navigate  = useNavigate();
  const location  = useLocation();
  const [toggling,        setToggling]        = useState(false);
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

  const toggleAvailability = async () => {
    if (toggling) return;
    setToggling(true);
    try {
      const { data } = await api.patch('/users/availability');
      updateUser({ isAvailable: data.isAvailable });
    } catch { /* silent */ } finally {
      setToggling(false);
    }
  };

  const sidebarProps = {
    nav: NAV_RESPONDER,
    user,
    toggling,
    onToggleAvailability: toggleAvailability,
    onLogout: handleLogout,
  };

  return (
    <div className="flex h-screen bg-zinc-950 text-zinc-100 overflow-hidden">

      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-[220px] shrink-0 bg-zinc-900/98 border-r border-zinc-800/60 flex-col overflow-hidden">
        <VolunteerSidebar {...sidebarProps} />
      </aside>

      {/* Mobile overlay sidebar */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
        >
          <aside
            className="w-64 h-full bg-zinc-900 border-r border-zinc-800 flex flex-col overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <VolunteerSidebar {...sidebarProps} />
          </aside>
        </div>
      )}

      {/* Main content area */}
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
            <div className="w-6 h-6 rounded-lg flex items-center justify-center shadow-sm bg-gradient-to-br from-blue-500 to-blue-700 shadow-blue-600/30">
              <Activity className="w-3 h-3 text-white" />
            </div>
            <span className="font-black text-sm tracking-tight">
              ResQ<span className="text-blue-400">AI</span>
            </span>
            <span className="text-[10px] text-zinc-600 font-medium">Responder</span>
          </div>
          <div className="ml-auto">
            <NotificationBell />
          </div>
        </div>

        {/* Broadcast alert banner (shown on every volunteer page) */}
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
            </div>
            <button
              onClick={() => setBroadcastAlert(null)}
              className="shrink-0 opacity-60 hover:opacity-100 transition-opacity p-1"
              aria-label="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          <Outlet />
        </div>
      </div>
    </div>
  );
};

export default VolunteerLayout;
