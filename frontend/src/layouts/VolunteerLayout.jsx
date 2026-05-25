import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard, MapPin, ClipboardList, Package,
  MessageCircle, User, LogOut, Zap, Building2, Bell,
  ChevronRight, Activity, Menu,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import NotificationBell from '../components/NotificationBell';

const NAV_RESPONDER = [
  { to: '/volunteer',             icon: LayoutDashboard, label: 'Dashboard',         exact: true  },
  { to: '/volunteer/incidents',   icon: MapPin,          label: 'Nearby Incidents',  exact: false },
  { to: '/volunteer/assignments', icon: ClipboardList,   label: 'My Assignments',    exact: false },
  { to: '/volunteer/resources',   icon: Package,         label: 'Resource Requests', exact: false },
  { to: '/notifications',         icon: Bell,            label: 'Notifications',     exact: false },
  { to: '/volunteer/chat',        icon: MessageCircle,   label: 'Chat',              exact: false },
  { to: '/volunteer/profile',     icon: User,            label: 'Profile',           exact: false },
];

const NAV_SHELTER_MANAGER = [
  { to: '/volunteer',             icon: LayoutDashboard, label: 'Overview',   exact: true  },
  { to: '/volunteer/shelter',     icon: Building2,       label: 'My Shelter', exact: false },
  { to: '/notifications',         icon: Bell,            label: 'Alerts',     exact: false },
  { to: '/volunteer/chat',        icon: MessageCircle,   label: 'Chat',       exact: false },
  { to: '/volunteer/profile',     icon: User,            label: 'Profile',    exact: false },
];

const VolunteerSidebar = ({ nav, isShelterManager, user, toggling, onToggleAvailability, onLogout }) => {
  const navLinkClass = ({ isActive }) =>
    `group flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm transition-all duration-200 relative ${
      isActive
        ? isShelterManager
          ? 'bg-teal-600/15 text-teal-400 font-semibold'
          : 'bg-blue-600/15 text-blue-400 font-semibold'
        : 'text-zinc-400 hover:bg-zinc-800/80 hover:text-zinc-100 font-medium'
    }`;

  return (
    <>
      {/* Logo */}
      <div className="px-4 py-4 border-b border-zinc-800/80">
        <div className="flex items-center gap-2.5">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-sm shadow-lg ${
            isShelterManager
              ? 'bg-teal-600 shadow-teal-600/40'
              : 'bg-blue-600 shadow-blue-600/40'
          }`}>
            {isShelterManager
              ? <Building2 className="w-[18px] h-[18px] text-white" />
              : <Activity className="w-[18px] h-[18px] text-white" />
            }
          </div>
          <div>
            <p className="text-sm font-black text-zinc-100 tracking-tight">
              ResQ<span className={isShelterManager ? 'text-teal-400' : 'text-blue-400'}>AI</span>
            </p>
            <p className="text-[9px] text-zinc-500 mt-0.5 font-medium">
              {isShelterManager ? 'Shelter Portal' : 'Responder Portal'}
            </p>
          </div>
        </div>
      </div>

      {/* Availability toggle (only for responders) */}
      {!isShelterManager && (
        <div className="px-3 py-3 border-b border-zinc-800/80">
          <button
            onClick={onToggleAvailability}
            disabled={toggling}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl border text-sm font-semibold transition-all duration-300 ${
              user?.isAvailable
                ? 'bg-green-500/15 border-green-500/30 text-green-400 hover:bg-green-500/25 shadow-sm shadow-green-500/10'
                : 'bg-zinc-800/80 border-zinc-700 text-zinc-400 hover:bg-zinc-700/80'
            }`}
          >
            <span className="flex items-center gap-2.5">
              <span className={`w-2.5 h-2.5 rounded-full transition-all ${
                user?.isAvailable
                  ? 'bg-green-400 shadow-sm shadow-green-400 animate-pulse'
                  : 'bg-zinc-600'
              }`} />
              {user?.isAvailable ? 'ON DUTY' : 'OFF DUTY'}
            </span>
            <Zap className={`w-3.5 h-3.5 ${toggling ? 'animate-spin' : ''}`} />
          </button>
        </div>
      )}

      {/* Nav links */}
      <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">
        <p className="px-3 py-1 text-[10px] font-bold text-zinc-600 uppercase tracking-widest mb-1">Navigation</p>
        {nav.map(({ to, icon: Icon, label, exact }) => (
          <NavLink key={to} to={to} end={exact} className={navLinkClass}>
            {({ isActive }) => (
              <>
                {isActive && (
                  <span className={`absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 rounded-r-full ${
                    isShelterManager ? 'bg-teal-400' : 'bg-blue-400'
                  }`} />
                )}
                <Icon className="w-4 h-4 shrink-0" />
                <span className="flex-1 truncate">{label}</span>
                {isActive && <ChevronRight className="w-3 h-3 opacity-50 shrink-0" />}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* User footer */}
      <div className="p-3 border-t border-zinc-800/80">
        <div className="flex items-center gap-2.5 mb-2.5 px-1">
          <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${
            isShelterManager ? 'from-teal-600 to-teal-700' : 'from-blue-600 to-blue-700'
          } flex items-center justify-center text-xs font-black text-white shadow-sm shrink-0`}>
            {user?.avatar
              ? <img src={user.avatar} alt="" className="w-full h-full rounded-full object-cover" />
              : user?.name?.[0]?.toUpperCase() || 'V'
            }
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-zinc-200 truncate">{user?.name}</p>
            <p className="text-[10px] text-zinc-500 capitalize truncate">{user?.role?.replace('_', ' ')}</p>
          </div>
          <NotificationBell />
        </div>
        <button
          onClick={onLogout}
          className="w-full flex items-center justify-center gap-2 py-2 text-xs font-semibold text-zinc-400 hover:text-red-400 hover:bg-red-950/30 border border-zinc-700/60 hover:border-red-800/50 rounded-xl transition-all duration-200"
        >
          <LogOut className="w-3.5 h-3.5" /> Sign Out
        </button>
      </div>
    </>
  );
};

const VolunteerLayout = () => {
  const { user, api, logout, updateUser } = useAuth();
  const navigate  = useNavigate();
  const location  = useLocation();
  const [toggling,   setToggling]   = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const isShelterManager = user?.role === 'shelter_manager';
  const nav = isShelterManager ? NAV_SHELTER_MANAGER : NAV_RESPONDER;

  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

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
    nav,
    isShelterManager,
    user,
    toggling,
    onToggleAvailability: toggleAvailability,
    onLogout: handleLogout,
  };

  return (
    <div className="flex h-screen bg-zinc-950 text-zinc-100 overflow-hidden">

      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-56 shrink-0 bg-zinc-900/95 border-r border-zinc-800/80 flex-col overflow-hidden">
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
        <div className="md:hidden flex items-center gap-3 px-4 py-3 bg-zinc-900/90 border-b border-zinc-800/80 shrink-0">
          <button
            onClick={() => setMobileOpen(true)}
            className="p-2 rounded-lg hover:bg-zinc-800 transition"
          >
            <Menu className="w-5 h-5 text-zinc-400" />
          </button>
          <span className="font-black text-sm">
            ResQ<span className={isShelterManager ? 'text-teal-400' : 'text-blue-400'}>AI</span>
          </span>
          <div className="ml-auto">
            <NotificationBell />
          </div>
        </div>

        <Outlet />
      </div>
    </div>
  );
};

export default VolunteerLayout;
