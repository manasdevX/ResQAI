import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard, AlertTriangle, Building2, Radio, BarChart3,
  Link2, MessageCircle, Users, User, LogOut, ChevronRight,
} from 'lucide-react';
import NotificationBell from '../components/NotificationBell';

const NAV = [
  { to: '/admin',           icon: LayoutDashboard, label: 'Operations Map',  exact: true },
  { to: '/admin/incidents', icon: AlertTriangle,   label: 'Incidents' },
  { to: '/admin/shelters',  icon: Building2,       label: 'Shelters' },
  { to: '/admin/alerts',    icon: Radio,           label: 'Broadcast Alerts' },
  { to: '/admin/analytics', icon: BarChart3,       label: 'Analytics' },
  { to: '/admin/users',     icon: Users,           label: 'Users' },
  { to: '/admin/invites',   icon: Link2,           label: 'Invite Links' },
  { to: '/admin/chat',      icon: MessageCircle,   label: 'Chat' },
  { to: '/admin/profile',   icon: User,            label: 'Profile' },
];

const AdminLayout = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => { logout(); navigate('/login'); };

  return (
    <div className="flex h-screen bg-zinc-950 text-zinc-100 overflow-hidden">

      {/* Sidebar */}
      <aside className="w-56 shrink-0 bg-zinc-900 border-r border-zinc-800 flex flex-col overflow-hidden">

        {/* Logo */}
        <div className="px-4 py-4 border-b border-zinc-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-red-600 flex items-center justify-center font-black text-sm shadow-lg shadow-red-600/30">R</div>
            <div>
              <p className="text-sm font-bold leading-none">ResQAI</p>
              <p className="text-[10px] text-zinc-500 mt-0.5">Operations Center</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">
          {NAV.map(({ to, icon: Icon, label, exact }) => (
            <NavLink
              key={to}
              to={to}
              end={exact}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all group ${
                  isActive
                    ? 'bg-red-600/20 text-red-400 border border-red-600/20'
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
            <div className="w-8 h-8 rounded-full bg-red-600/80 flex items-center justify-center text-xs font-bold shrink-0">
              {user?.name?.[0]?.toUpperCase() || 'A'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-zinc-200 truncate">{user?.name}</p>
              <p className="text-[10px] text-zinc-500 truncate">{user?.email}</p>
            </div>
            <NotificationBell />
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 py-1.5 text-xs font-medium text-zinc-400 hover:text-red-400 hover:bg-red-950/30 border border-zinc-700 hover:border-red-800 rounded-lg transition"
          >
            <LogOut className="w-3.5 h-3.5" /> Logout
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <Outlet />
      </div>
    </div>
  );
};

export default AdminLayout;
