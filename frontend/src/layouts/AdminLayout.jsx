import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard, AlertTriangle, Building2, Radio, BarChart3,
  Link2, MessageCircle, Users, User, LogOut, ChevronRight,
  Shield, Menu,
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
    <div className="px-4 py-4 border-b border-zinc-800/80">
      <div className="flex items-center gap-2.5">
        <div className="relative w-9 h-9 rounded-xl bg-red-600 flex items-center justify-center shadow-lg shadow-red-600/40">
          <Shield className="w-[18px] h-[18px] text-white" />
        </div>
        <div>
          <p className="text-sm font-black text-zinc-100 tracking-tight">
            ResQ<span className="text-red-400">AI</span>
          </p>
          <p className="text-[9px] text-zinc-500 mt-0.5 font-semibold uppercase tracking-wider">Operations Center</p>
        </div>
      </div>

      {/* Admin status indicator */}
      <div className="mt-3 flex items-center gap-2 px-2 py-1.5 bg-red-950/30 border border-red-800/30 rounded-lg">
        <span className="w-1.5 h-1.5 bg-red-400 rounded-full animate-pulse" />
        <span className="text-[10px] text-red-400 font-bold uppercase tracking-wider">Admin Access</span>
      </div>
    </div>

    {/* Nav sections */}
    <nav className="flex-1 py-3 px-2 space-y-5 overflow-y-auto">
      {NAV_SECTIONS.map(({ title, items }) => (
        <div key={title}>
          <p className="px-3 mb-1.5 text-[10px] font-bold text-zinc-600 uppercase tracking-widest">{title}</p>
          <div className="space-y-0.5">
            {items.map(item => <NavItem key={item.to} {...item} />)}
          </div>
        </div>
      ))}
    </nav>

    {/* User footer */}
    <div className="p-3 border-t border-zinc-800/80">
      <div className="flex items-center gap-2.5 mb-2.5 px-1">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-red-600 to-red-700 flex items-center justify-center text-xs font-black text-white shadow-sm shrink-0">
          {user?.avatar
            ? <img src={user.avatar} alt="" className="w-full h-full rounded-full object-cover" />
            : user?.name?.[0]?.toUpperCase() || 'A'
          }
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold text-zinc-200 truncate">{user?.name}</p>
          <p className="text-[10px] text-red-400 font-semibold uppercase truncate">Administrator</p>
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

const AdminLayout = () => {
  const { user, logout } = useAuth();
  const navigate  = useNavigate();
  const location  = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  const handleLogout = () => { logout(); navigate('/login'); };

  return (
    <div className="flex h-screen bg-zinc-950 text-zinc-100 overflow-hidden">

      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-56 shrink-0 bg-zinc-900/95 border-r border-zinc-800/80 flex-col overflow-hidden">
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
        <div className="md:hidden flex items-center gap-3 px-4 py-3 bg-zinc-900/90 border-b border-zinc-800/80 shrink-0">
          <button
            onClick={() => setMobileOpen(true)}
            className="p-2 rounded-lg hover:bg-zinc-800 transition"
          >
            <Menu className="w-5 h-5 text-zinc-400" />
          </button>
          <span className="font-black text-sm">
            ResQ<span className="text-red-400">AI</span>
            <span className="ml-2 text-[10px] text-zinc-500 font-normal">Admin</span>
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

export default AdminLayout;
