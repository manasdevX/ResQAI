import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  Home, AlertOctagon, Building2, Package, FileText,
  MessageCircle, User, LogOut, Menu, X, Bell,
  ChevronRight, Shield,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { useNotifications } from '../context/NotificationContext';
import NotificationBell from '../components/NotificationBell';

// ── Primary desktop nav items (left of divider) ───────────────────────────────
const PRIMARY_NAV = [
  { to: '/home',       icon: Home,         label: 'Home'            },
  { to: '/report',     icon: AlertOctagon, label: 'Report Emergency'},
  { to: '/shelters',   icon: Building2,    label: 'Find Shelter'    },
  { to: '/resources',  icon: Package,      label: 'Request Help'    },
  { to: '/my-reports', icon: FileText,     label: 'My Reports'      },
  { to: '/chat',       icon: MessageCircle,label: 'Chat'            },
];

// ── Full list for mobile drawer (includes notifications & profile) ─────────────
const ALL_NAV = [
  { to: '/home',          icon: Home,          label: 'Home'              },
  { to: '/report',        icon: AlertOctagon,  label: 'Report Emergency'  },
  { to: '/shelters',      icon: Building2,     label: 'Find Shelter'      },
  { to: '/resources',     icon: Package,       label: 'Request Help'      },
  { to: '/my-reports',    icon: FileText,      label: 'My Reports'        },
  { to: '/notifications', icon: Bell,          label: 'Notifications'     },
  { to: '/chat',          icon: MessageCircle, label: 'Chat'              },
  { to: '/profile',       icon: User,          label: 'Profile'           },
];

// ── Mobile bottom bar ─────────────────────────────────────────────────────────
const BOTTOM_NAV = [
  { to: '/home',          icon: Home,          label: 'Home'    },
  { to: '/report',        icon: AlertOctagon,  label: 'Report'  },
  { to: '/shelters',      icon: Building2,     label: 'Shelter' },
  { to: '/my-reports',    icon: FileText,      label: 'Reports' },
  { to: '/profile',       icon: User,          label: 'Profile' },
];

// ── Desktop nav link ──────────────────────────────────────────────────────────
const NavItem = ({ to, icon: Icon, label }) => (
  <NavLink
    to={to}
    className={({ isActive }) =>
      `flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium transition-all duration-200 whitespace-nowrap ${
        isActive
          ? 'bg-red-600/15 text-red-400 shadow-sm shadow-red-600/10'
          : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/70'
      }`
    }
  >
    {({ isActive }) => (
      <>
        <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-red-400' : ''}`} />
        <span>{label}</span>
      </>
    )}
  </NavLink>
);

// ── Mobile drawer nav link ────────────────────────────────────────────────────
const DrawerNavItem = ({ to, icon: Icon, label, unreadCount }) => (
  <NavLink
    to={to}
    className={({ isActive }) =>
      `flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 relative ${
        isActive
          ? 'bg-red-600/15 text-red-400 border border-red-600/20'
          : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/70 border border-transparent'
      }`
    }
  >
    {({ isActive }) => (
      <>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
          isActive ? 'bg-red-600/20' : 'bg-zinc-800'
        }`}>
          <Icon className={`w-4 h-4 ${isActive ? 'text-red-400' : 'text-zinc-400'}`} />
          {to === '/notifications' && unreadCount > 0 && (
            <span className="absolute top-2.5 left-8 w-2 h-2 bg-red-500 rounded-full" />
          )}
        </div>
        <span className="flex-1">{label}</span>
        {isActive && <ChevronRight className="w-4 h-4 opacity-40" />}
      </>
    )}
  </NavLink>
);

// ── Avatar with onError fallback ──────────────────────────────────────────────
const AvatarChip = ({ avatar, initials, size = 'sm' }) => {
  const [imgError, setImgError] = useState(false);
  const dim = size === 'lg' ? 'w-10 h-10 text-sm' : 'w-6 h-6 text-[11px]';
  const ring = size === 'lg' ? 'ring-2 ring-zinc-600' : 'ring-1 ring-zinc-600';

  if (avatar && !imgError) {
    return (
      <img
        src={avatar}
        alt=""
        className={`${dim} rounded-full object-cover ${ring} shrink-0`}
        onError={() => setImgError(true)}
        referrerPolicy="no-referrer"
      />
    );
  }

  return (
    <div className={`${dim} rounded-full bg-gradient-to-br from-red-600 to-red-700 flex items-center justify-center font-black text-white shrink-0`}>
      {initials}
    </div>
  );
};

// ── Layout ────────────────────────────────────────────────────────────────────
const CitizenLayout = () => {
  const { user, logout }     = useAuth();
  const { unreadCount }      = useNotifications();
  const navigate             = useNavigate();
  const location             = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  const handleLogout = () => { logout(); navigate('/login'); };

  const avatar = user?.avatar;
  const initials = user?.name?.[0]?.toUpperCase() || 'U';
  const firstName = user?.name?.split(' ')[0] || 'User';

  return (
    <div className="h-screen bg-zinc-950 text-zinc-100 flex flex-col overflow-hidden">

      {/* ── Top navbar ──────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 bg-zinc-900/95 backdrop-blur-2xl border-b border-zinc-800/50 shrink-0">
        {/* Red accent gradient line */}
        <div className="h-[2px] w-full bg-gradient-to-r from-transparent via-red-500/80 to-transparent" />

        <div className="max-w-screen-2xl mx-auto px-5 sm:px-8 flex items-center justify-between h-[60px] gap-4">

          {/* ── Logo ──────────────────────────────────────────────────────── */}
          <NavLink to="/home" className="flex items-center gap-3 shrink-0 group">
            <div className="relative w-9 h-9 rounded-xl bg-gradient-to-br from-red-600 to-red-700 flex items-center justify-center shadow-lg shadow-red-600/30 group-hover:shadow-red-600/50 transition-all duration-300">
              <Shield className="w-4 h-4 text-white" />
              <span className="absolute inset-0 rounded-xl ring-2 ring-red-500/0 group-hover:ring-red-500/40 transition-all duration-300" />
            </div>
            <div className="leading-none">
              <p className="text-base font-black tracking-tight text-zinc-50">
                ResQ<span className="text-red-400">AI</span>
              </p>
              <p className="text-[10px] text-zinc-500 font-medium mt-0.5">Emergency Response</p>
            </div>
          </NavLink>

          {/* ── Desktop nav ──────────────────────────────────────────────── */}
          <nav className="hidden lg:flex items-center gap-1 flex-1 justify-center max-w-2xl">
            {PRIMARY_NAV.map(item => <NavItem key={item.to} {...item} />)}
          </nav>

          {/* ── Right side ───────────────────────────────────────────────── */}
          <div className="flex items-center gap-2 shrink-0">

            {/* Single notification bell — dropdown + "View all" link to /notifications */}
            <NotificationBell />

            {/* Divider */}
            <div className="hidden sm:block w-px h-6 bg-zinc-700/60 mx-1" />

            {/* User chip */}
            <NavLink
              to="/profile"
              className="hidden sm:flex items-center gap-2.5 px-3 py-2 bg-zinc-800/50 hover:bg-zinc-800 border border-zinc-700/50 hover:border-zinc-600/80 rounded-xl transition-all duration-200 group"
            >
              <AvatarChip avatar={avatar} initials={initials} size="sm" />
              <span className="text-sm text-zinc-300 font-medium group-hover:text-zinc-100 transition-colors max-w-[90px] truncate">
                {firstName}
              </span>
            </NavLink>

            {/* Logout button */}
            <button
              onClick={handleLogout}
              title="Sign out"
              className="hidden md:flex items-center gap-1.5 px-3.5 py-2 text-sm text-zinc-400 hover:text-red-400 bg-zinc-800/50 hover:bg-red-950/40 border border-zinc-700/50 hover:border-red-800/50 rounded-xl transition-all duration-200 font-medium"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden xl:inline">Sign out</span>
            </button>

            {/* Mobile hamburger */}
            <button
              onClick={() => setMobileOpen(o => !o)}
              className="lg:hidden p-2.5 rounded-xl text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-all duration-200 border border-transparent hover:border-zinc-700/50"
              aria-label="Toggle menu"
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </header>

      {/* ── Mobile fullscreen drawer ─────────────────────────────────────────── */}
      <div
        className={`lg:hidden fixed inset-0 z-50 transition-all duration-300 ${
          mobileOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      >
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-black/70 backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
        />

        {/* Drawer panel */}
        <div className={`absolute right-0 top-0 h-full w-72 bg-zinc-900 border-l border-zinc-800/80 flex flex-col shadow-2xl shadow-black/60 transition-transform duration-300 ${
          mobileOpen ? 'translate-x-0' : 'translate-x-full'
        }`}>

          {/* Drawer header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800/80">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-red-600 to-red-700 flex items-center justify-center shadow-md shadow-red-600/30">
                <Shield className="w-3.5 h-3.5 text-white" />
              </div>
              <span className="font-black text-sm">ResQ<span className="text-red-400">AI</span></span>
            </div>
            <button
              onClick={() => setMobileOpen(false)}
              className="p-2 rounded-xl text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-all"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* User card */}
          <div className="mx-4 mt-4 p-3.5 bg-zinc-800/60 border border-zinc-700/50 rounded-2xl flex items-center gap-3">
            <AvatarChip avatar={avatar} initials={initials} size="lg" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-zinc-100 truncate">{user?.name}</p>
              <p className="text-xs text-zinc-500 mt-0.5 truncate">
                {user?.email}
              </p>
            </div>
            {unreadCount > 0 && (
              <span className="text-[10px] font-black px-2 py-1 bg-red-500/20 text-red-400 border border-red-500/30 rounded-full">
                {unreadCount}
              </span>
            )}
          </div>

          {/* Nav links */}
          <nav className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
            {ALL_NAV.map(item => (
              <DrawerNavItem key={item.to} {...item} unreadCount={unreadCount} />
            ))}
          </nav>

          {/* Sign out */}
          <div className="px-4 pb-6 pt-2 border-t border-zinc-800/80">
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm font-medium text-red-400 hover:bg-red-950/30 border border-transparent hover:border-red-800/30 transition-all duration-200"
            >
              <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center">
                <LogOut className="w-4 h-4" />
              </div>
              Sign Out
            </button>
          </div>
        </div>
      </div>

      {/* ── Page content ─────────────────────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto pb-16 lg:pb-0">
        <Outlet />
      </main>

      {/* ── Mobile bottom navigation bar ─────────────────────────────────────── */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-zinc-900/98 backdrop-blur-xl border-t border-zinc-800/70 flex">
        {BOTTOM_NAV.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center justify-center pt-2 pb-3 gap-1 text-[10px] font-semibold transition-all relative ${
                isActive ? 'text-red-400' : 'text-zinc-500 active:text-zinc-300'
              }`
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-[3px] bg-red-500 rounded-b-full" />
                )}
                <span className={`p-1.5 rounded-xl transition-all duration-200 ${isActive ? 'bg-red-500/15' : ''}`}>
                  {to === '/profile' && unreadCount > 0 ? (
                    <span className="relative">
                      <Icon className="w-[19px] h-[19px]" />
                      <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full border border-zinc-900" />
                    </span>
                  ) : (
                    <Icon className="w-[19px] h-[19px]" />
                  )}
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
