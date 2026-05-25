import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  Home, AlertOctagon, Building2, Package, FileText,
  MessageCircle, User, LogOut, Menu, X, Bell, Zap,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import NotificationBell from '../components/NotificationBell';

const NAV = [
  { to: '/home',          icon: Home,          label: 'Home',             short: 'Home'     },
  { to: '/report',        icon: AlertOctagon,  label: 'Report Emergency', short: 'Report'   },
  { to: '/shelters',      icon: Building2,     label: 'Find Shelter',     short: 'Shelters' },
  { to: '/resources',     icon: Package,       label: 'Request Help',     short: 'Help'     },
  { to: '/my-reports',    icon: FileText,      label: 'My Reports',       short: 'Reports'  },
  { to: '/notifications', icon: Bell,          label: 'Notifications',    short: 'Alerts'   },
  { to: '/chat',          icon: MessageCircle, label: 'Emergency Chat',   short: 'Chat'     },
  { to: '/profile',       icon: User,          label: 'Profile',          short: 'Profile'  },
];

// Bottom-bar nav (most used items for mobile)
const BOTTOM_NAV = [
  { to: '/home',       icon: Home,         label: 'Home'    },
  { to: '/report',     icon: AlertOctagon, label: 'Report'  },
  { to: '/shelters',   icon: Building2,    label: 'Shelter' },
  { to: '/my-reports', icon: FileText,     label: 'Reports' },
  { to: '/profile',    icon: User,         label: 'Profile' },
];

const CitizenLayout = () => {
  const { user, logout } = useAuth();
  const navigate         = useNavigate();
  const location         = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close mobile menu on route change
  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  const handleLogout = () => { logout(); navigate('/login'); };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">

      {/* ── Top navbar ─────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 bg-zinc-900/95 backdrop-blur-md border-b border-zinc-800/80">
        {/* Subtle gradient accent line at top */}
        <div className="h-px w-full bg-gradient-to-r from-red-600/0 via-red-600/60 to-red-600/0" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between h-14">

          {/* Logo */}
          <NavLink to="/home" className="flex items-center gap-2.5 shrink-0 group">
            <div className="relative w-8 h-8 rounded-xl bg-red-600 flex items-center justify-center font-black text-sm shadow-lg shadow-red-600/40 group-hover:shadow-red-600/60 transition-shadow">
              <span className="text-white">R</span>
              <span className="absolute inset-0 rounded-xl bg-red-500 animate-ping opacity-20 group-hover:opacity-40" />
            </div>
            <div>
              <span className="font-black text-sm tracking-tight text-zinc-100">ResQ<span className="text-red-400">AI</span></span>
              <p className="text-[9px] text-zinc-500 -mt-0.5 font-medium">Emergency Response</p>
            </div>
          </NavLink>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-0.5">
            {NAV.map(({ to, icon: Icon, label }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
                    isActive
                      ? 'bg-blue-600/20 text-blue-400 ring-1 ring-blue-600/20'
                      : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/80'
                  }`
                }
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                {label}
              </NavLink>
            ))}
          </nav>

          {/* Right: notification bell + greeting + logout */}
          <div className="flex items-center gap-2">
            <NotificationBell />

            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 bg-zinc-800/60 rounded-lg border border-zinc-700/50">
              <div className="w-5 h-5 rounded-full bg-blue-600/80 flex items-center justify-center text-[10px] font-black text-white">
                {user?.name?.[0]?.toUpperCase() || 'U'}
              </div>
              <span className="text-xs text-zinc-300 font-medium">{user?.name?.split(' ')[0]}</span>
            </div>

            <button
              onClick={handleLogout}
              title="Logout"
              className="hidden md:flex items-center gap-1.5 text-xs px-3 py-1.5 bg-zinc-800/80 hover:bg-red-950/50 hover:text-red-400 border border-zinc-700 hover:border-red-800/60 rounded-lg transition-all duration-200"
            >
              <LogOut className="w-3.5 h-3.5" /> Logout
            </button>

            {/* Mobile hamburger */}
            <button
              onClick={() => setMobileOpen(o => !o)}
              className="md:hidden p-2 rounded-lg hover:bg-zinc-800 transition-colors"
              aria-label="Toggle menu"
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile drawer */}
        <div className={`md:hidden overflow-hidden transition-all duration-300 ease-in-out ${mobileOpen ? 'max-h-screen opacity-100' : 'max-h-0 opacity-0'}`}>
          <div className="border-t border-zinc-800 bg-zinc-900/98 backdrop-blur-md px-4 py-4 space-y-1">
            {/* User info */}
            <div className="flex items-center gap-3 px-3 py-3 mb-3 bg-zinc-800/60 rounded-xl border border-zinc-700/50">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-600 to-blue-700 flex items-center justify-center text-sm font-black text-white shadow">
                {user?.name?.[0]?.toUpperCase() || 'U'}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-zinc-100 truncate">{user?.name}</p>
                <p className="text-xs text-zinc-500 capitalize">{user?.role}</p>
              </div>
              <NotificationBell />
            </div>

            {NAV.map(({ to, icon: Icon, label }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-blue-600/20 text-blue-400 border border-blue-600/20'
                      : 'text-zinc-400 hover:bg-zinc-800/80 hover:text-zinc-100'
                  }`
                }
              >
                <Icon className="w-4 h-4 shrink-0" /> {label}
              </NavLink>
            ))}

            <div className="pt-2 border-t border-zinc-800 mt-2">
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-red-400 hover:bg-red-950/30 hover:text-red-300 transition-all"
              >
                <LogOut className="w-4 h-4" /> Sign Out
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Page content */}
      <main className="flex-1 pb-16 md:pb-0">
        <Outlet />
      </main>

      {/* Mobile bottom navigation */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-zinc-900/98 backdrop-blur-md border-t border-zinc-800/80 flex">
        {BOTTOM_NAV.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center justify-center py-2 gap-1 text-[10px] font-semibold transition-all ${
                isActive ? 'text-blue-400' : 'text-zinc-500 hover:text-zinc-300'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <span className={`p-1 rounded-lg transition-all ${isActive ? 'bg-blue-600/20' : ''}`}>
                  <Icon className="w-4.5 h-4.5" />
                </span>
                <span>{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  );
};

export default CitizenLayout;
