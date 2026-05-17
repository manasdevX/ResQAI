import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Home, AlertOctagon, Building2, Package, FileText, MessageCircle, LogOut, Menu, X } from 'lucide-react';
import { useState } from 'react';

const NAV = [
  { to: '/home',        icon: Home,          label: 'Home' },
  { to: '/report',      icon: AlertOctagon,  label: 'Report Emergency' },
  { to: '/shelters',    icon: Building2,     label: 'Find Shelter' },
  { to: '/resources',   icon: Package,       label: 'Request Help' },
  { to: '/my-reports',  icon: FileText,      label: 'My Reports' },
  { to: '/chat',        icon: MessageCircle, label: 'Chat' },
];

const CitizenLayout = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = () => { logout(); navigate('/login'); };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">

      {/* Top navbar */}
      <header className="sticky top-0 z-30 bg-zinc-900/95 backdrop-blur-sm border-b border-zinc-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between h-14">

          {/* Logo */}
          <NavLink to="/home" className="flex items-center gap-2.5 shrink-0">
            <div className="w-7 h-7 rounded-full bg-red-600 flex items-center justify-center font-black text-xs shadow-lg shadow-red-600/30">R</div>
            <span className="font-bold text-sm">ResQAI</span>
          </NavLink>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-1">
            {NAV.map(({ to, icon: Icon, label }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-blue-600/20 text-blue-400'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
                  }`
                }
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </NavLink>
            ))}
          </nav>

          {/* Right: user + logout */}
          <div className="flex items-center gap-3">
            <span className="hidden sm:block text-xs text-zinc-500">
              Hi, <span className="text-zinc-300 font-medium">{user?.name?.split(' ')[0]}</span>
            </span>
            <button
              onClick={handleLogout}
              className="hidden md:flex items-center gap-1.5 text-xs px-3 py-1.5 bg-zinc-800 hover:bg-red-950/40 hover:text-red-400 border border-zinc-700 hover:border-red-800 rounded-lg transition"
            >
              <LogOut className="w-3 h-3" /> Logout
            </button>
            <button
              onClick={() => setMobileOpen(o => !o)}
              className="md:hidden p-2 rounded-lg hover:bg-zinc-800 transition"
            >
              {mobileOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="md:hidden border-t border-zinc-800 bg-zinc-900 px-4 py-3 space-y-1">
            {NAV.map(({ to, icon: Icon, label }) => (
              <NavLink
                key={to}
                to={to}
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-blue-600/20 text-blue-400'
                      : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
                  }`
                }
              >
                <Icon className="w-4 h-4" /> {label}
              </NavLink>
            ))}
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium text-red-400 hover:bg-red-950/30 transition"
            >
              <LogOut className="w-4 h-4" /> Logout
            </button>
          </div>
        )}
      </header>

      {/* Page content */}
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  );
};

export default CitizenLayout;
