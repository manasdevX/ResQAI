import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard, MapPin, ClipboardList, Package,
  MessageCircle, LogOut, ChevronRight, Zap,
} from 'lucide-react';

const NAV = [
  { to: '/volunteer',              icon: LayoutDashboard, label: 'Dashboard',       exact: true },
  { to: '/volunteer/incidents',    icon: MapPin,          label: 'Nearby Incidents' },
  { to: '/volunteer/assignments',  icon: ClipboardList,   label: 'My Assignments' },
  { to: '/volunteer/resources',    icon: Package,         label: 'Resource Requests' },
  { to: '/volunteer/chat',         icon: MessageCircle,   label: 'Chat' },
];

const VolunteerLayout = () => {
  const { user, api, logout, updateUser } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => { logout(); navigate('/login'); };

  const toggleAvailability = async () => {
    try {
      const { data } = await api.patch('/users/availability');
      updateUser({ isAvailable: data.isAvailable });
    } catch {
      /* silent fail */
    }
  };

  return (
    <div className="flex h-screen bg-zinc-950 text-zinc-100 overflow-hidden">

      {/* Sidebar */}
      <aside className="w-56 shrink-0 bg-zinc-900 border-r border-zinc-800 flex flex-col overflow-hidden">

        {/* Logo */}
        <div className="px-4 py-4 border-b border-zinc-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center font-black text-sm shadow-lg shadow-blue-600/30">V</div>
            <div>
              <p className="text-sm font-bold leading-none">ResQAI</p>
              <p className="text-[10px] text-zinc-500 mt-0.5">Volunteer Portal</p>
            </div>
          </div>
        </div>

        {/* Availability toggle */}
        <div className="px-3 py-3 border-b border-zinc-800">
          <button
            onClick={toggleAvailability}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-lg border text-sm font-semibold transition-all ${
              user?.isAvailable
                ? 'bg-green-500/15 border-green-500/30 text-green-400 hover:bg-green-500/25'
                : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:bg-zinc-700'
            }`}
          >
            <span className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${user?.isAvailable ? 'bg-green-400 animate-pulse' : 'bg-zinc-500'}`} />
              {user?.isAvailable ? 'ON DUTY' : 'OFF DUTY'}
            </span>
            <Zap className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">
          {NAV.map(({ to, icon: Icon, label, exact }) => (
            <NavLink
              key={to}
              to={to}
              end={exact}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all ${
                  isActive
                    ? 'bg-blue-600/20 text-blue-400 border border-blue-600/20'
                    : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="flex-1 font-medium">{label}</span>
                  {isActive && <ChevronRight className="w-3 h-3 opacity-60" />}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* User footer */}
        <div className="p-3 border-t border-zinc-800">
          <div className="flex items-center gap-2.5 mb-2.5">
            <div className="w-8 h-8 rounded-full bg-blue-600/80 flex items-center justify-center text-xs font-bold shrink-0">
              {user?.name?.[0]?.toUpperCase() || 'V'}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-zinc-200 truncate">{user?.name}</p>
              <p className="text-[10px] text-zinc-500 capitalize truncate">{user?.role?.replace('_', ' ')}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 py-1.5 text-xs font-medium text-zinc-400 hover:text-red-400 hover:bg-red-950/30 border border-zinc-700 hover:border-red-800 rounded-lg transition"
          >
            <LogOut className="w-3.5 h-3.5" /> Logout
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <Outlet />
      </div>
    </div>
  );
};

export default VolunteerLayout;
