import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Search, RefreshCw, AlertTriangle, ChevronLeft, ChevronRight, Shield, CheckCircle, XCircle, ChevronDown } from 'lucide-react';

const ROLES = ['all', 'citizen', 'responder', 'shelter_manager', 'admin'];

const ROLE_BADGE = {
  admin:           { label: 'Admin',           bg: 'bg-red-500/15 text-red-400 border-red-500/30' },
  responder:       { label: 'Responder',       bg: 'bg-blue-500/15 text-blue-400 border-blue-500/30' },
  shelter_manager: { label: 'Shelter Mgr',    bg: 'bg-purple-500/15 text-purple-400 border-purple-500/30' },
  citizen:         { label: 'Citizen',         bg: 'bg-green-500/15 text-green-400 border-green-500/30' },
};

const ASSIGNABLE_ROLES = [
  { value: 'citizen',         label: 'Citizen' },
  { value: 'responder',       label: 'Responder' },
  { value: 'shelter_manager', label: 'Shelter Manager' },
];

const PAGE_LIMIT = 20;

const AdminUserManager = () => {
  const { api, user: me } = useAuth();

  const [users,    setUsers]    = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);
  const [search,   setSearch]   = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [page,     setPage]     = useState(1);
  const [pages,    setPages]    = useState(1);
  const [total,    setTotal]    = useState(0);

  // Per-row action states
  const [actionLoading, setActionLoading] = useState({}); // { userId: 'role'|'active' }
  const [feedback,      setFeedback]      = useState({}); // { userId: { type, text } }
  const [openRoleMenu,  setOpenRoleMenu]  = useState(null);

  const searchDebounce = useRef(null);

  const fetch = useCallback(async (pg = 1, q = search, role = roleFilter) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: pg, limit: PAGE_LIMIT });
      if (q)              params.set('search', q);
      if (role !== 'all') params.set('role',   role);

      const { data } = await api.get(`/users/all?${params}`);
      if (data.success) {
        setUsers(data.users || []);
        setTotal(data.total  || 0);
        setPages(data.pages  || 1);
        setPage(pg);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }, [api, search, roleFilter]);

  // Debounce search
  useEffect(() => {
    clearTimeout(searchDebounce.current);
    searchDebounce.current = setTimeout(() => fetch(1, search, roleFilter), 300);
    return () => clearTimeout(searchDebounce.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, roleFilter]);

  const showFeedback = (userId, type, text) => {
    setFeedback(prev => ({ ...prev, [userId]: { type, text } }));
    setTimeout(() => setFeedback(prev => { const n = { ...prev }; delete n[userId]; return n; }), 3000);
  };

  const handleRoleChange = async (userId, newRole) => {
    setOpenRoleMenu(null);
    setActionLoading(prev => ({ ...prev, [userId]: 'role' }));
    try {
      await api.patch(`/users/${userId}/role`, { role: newRole });
      setUsers(prev => prev.map(u => u._id === userId ? { ...u, role: newRole } : u));
      showFeedback(userId, 'success', `Role changed to ${newRole.replace('_', ' ')}`);
    } catch (err) {
      showFeedback(userId, 'error', err.response?.data?.message || 'Failed to change role');
    } finally {
      setActionLoading(prev => { const n = { ...prev }; delete n[userId]; return n; });
    }
  };

  const handleToggleActive = async (userId, currentActive) => {
    setActionLoading(prev => ({ ...prev, [userId]: 'active' }));
    try {
      const { data } = await api.patch(`/users/${userId}/active`);
      setUsers(prev => prev.map(u => u._id === userId ? { ...u, isActive: data.isActive } : u));
      showFeedback(userId, 'success', data.message);
    } catch (err) {
      showFeedback(userId, 'error', err.response?.data?.message || 'Failed to update account status');
    } finally {
      setActionLoading(prev => { const n = { ...prev }; delete n[userId]; return n; });
    }
  };

  const goToPage = (pg) => { if (pg >= 1 && pg <= pages && pg !== page) fetch(pg); };

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-lg font-black text-zinc-100">User Management</h1>
          <p className="text-xs text-zinc-500 mt-0.5">{total} total users — manage roles and account status</p>
        </div>
        <button
          onClick={() => fetch(page)}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg text-xs font-medium text-zinc-300 transition"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      {/* Search + role filter */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500 pointer-events-none" />
          <input
            type="text"
            placeholder="Search by name or email…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-blue-500 transition"
          />
        </div>

        <div className="flex gap-1 flex-wrap">
          {ROLES.map(r => (
            <button
              key={r}
              onClick={() => setRoleFilter(r)}
              className={`px-3 py-1.5 rounded-xl border text-xs font-semibold capitalize transition ${
                roleFilter === r
                  ? 'bg-blue-600 border-blue-500 text-white'
                  : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-600'
              }`}
            >
              {r === 'all' ? 'All roles' : r.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3.5 bg-red-950/40 border border-red-800/40 rounded-xl text-red-400 text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}

      {/* User list */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="p-4 bg-zinc-900 border border-zinc-800 rounded-2xl animate-pulse flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-zinc-800" />
              <div className="flex-1 space-y-2">
                <div className="h-3.5 bg-zinc-800 rounded w-1/3" />
                <div className="h-3 bg-zinc-800 rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : users.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-zinc-500">
          <Shield className="w-12 h-12 mb-3 opacity-20" />
          <p className="text-sm font-semibold text-zinc-400">No users found</p>
          <p className="text-xs mt-1">Try a different search or filter</p>
        </div>
      ) : (
        <div className="space-y-2">
          {users.map(u => {
            const badge     = ROLE_BADGE[u.role] || ROLE_BADGE.citizen;
            const isMe      = u._id === me?._id;
            const isAdmin   = u.role === 'admin';
            const busy      = actionLoading[u._id];
            const fb        = feedback[u._id];
            const initials  = u.name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '?';

            return (
              <div
                key={u._id}
                className={`p-4 bg-zinc-900 border rounded-2xl transition-all ${
                  !u.isActive ? 'border-zinc-800/50 opacity-60' : 'border-zinc-800 hover:border-zinc-700'
                }`}
              >
                <div className="flex items-center gap-3 flex-wrap">

                  {/* Avatar */}
                  <div className="w-10 h-10 rounded-full bg-zinc-700 overflow-hidden flex items-center justify-center shrink-0 border border-zinc-600">
                    {u.avatar
                      ? <img src={u.avatar} alt={u.name} className="w-full h-full object-cover" />
                      : <span className="text-sm font-bold text-zinc-300">{initials}</span>
                    }
                  </div>

                  {/* Name + email */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-zinc-100 truncate">
                        {u.name}
                        {isMe && <span className="ml-1.5 text-[10px] text-zinc-500 font-normal">(you)</span>}
                      </p>
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${badge.bg}`}>
                        {badge.label}
                      </span>
                      {!u.isActive && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-500 border border-zinc-700">
                          Inactive
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-zinc-500 truncate mt-0.5">{u.email}</p>
                    <p className="text-[10px] text-zinc-700 mt-0.5">
                      Joined {new Date(u.createdAt).toLocaleDateString('en', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                  </div>

                  {/* Actions */}
                  {!isMe && !isAdmin && (
                    <div className="flex items-center gap-2 shrink-0">

                      {/* Role change dropdown */}
                      <div className="relative">
                        <button
                          onClick={() => setOpenRoleMenu(openRoleMenu === u._id ? null : u._id)}
                          disabled={!!busy}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg text-xs font-medium text-zinc-300 transition disabled:opacity-50"
                        >
                          {busy === 'role' ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Shield className="w-3 h-3" />}
                          Change Role
                          <ChevronDown className="w-3 h-3" />
                        </button>

                        {openRoleMenu === u._id && (
                          <div className="absolute right-0 top-full mt-1 bg-zinc-800 border border-zinc-700 rounded-xl shadow-xl z-20 py-1 min-w-[160px]">
                            {ASSIGNABLE_ROLES.map(r => (
                              <button
                                key={r.value}
                                onClick={() => handleRoleChange(u._id, r.value)}
                                disabled={u.role === r.value}
                                className={`w-full text-left px-3 py-2 text-xs transition ${
                                  u.role === r.value
                                    ? 'text-zinc-600 cursor-default'
                                    : 'text-zinc-300 hover:bg-zinc-700'
                                }`}
                              >
                                {u.role === r.value && '✓ '}{r.label}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Activate / Deactivate */}
                      <button
                        onClick={() => handleToggleActive(u._id, u.isActive)}
                        disabled={!!busy}
                        className={`flex items-center gap-1.5 px-2.5 py-1.5 border rounded-lg text-xs font-medium transition disabled:opacity-50 ${
                          u.isActive
                            ? 'bg-red-950/30 border-red-800/40 text-red-400 hover:bg-red-950/50'
                            : 'bg-green-950/30 border-green-800/40 text-green-400 hover:bg-green-950/50'
                        }`}
                      >
                        {busy === 'active'
                          ? <RefreshCw className="w-3 h-3 animate-spin" />
                          : u.isActive
                            ? <><XCircle className="w-3 h-3" /> Deactivate</>
                            : <><CheckCircle className="w-3 h-3" /> Activate</>
                        }
                      </button>
                    </div>
                  )}

                  {(isMe || isAdmin) && (
                    <span className="text-[10px] text-zinc-700 italic shrink-0">
                      {isMe ? 'Your account' : 'Admin account'}
                    </span>
                  )}
                </div>

                {/* Per-row feedback */}
                {fb && (
                  <div className={`mt-2 text-xs px-3 py-1.5 rounded-lg ${
                    fb.type === 'success'
                      ? 'bg-green-950/30 text-green-400 border border-green-800/30'
                      : 'bg-red-950/30 text-red-400 border border-red-800/30'
                  }`}>
                    {fb.type === 'success' ? '✓ ' : '✗ '}{fb.text}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <button
            onClick={() => goToPage(page - 1)}
            disabled={page <= 1 || loading}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed border border-zinc-800 transition"
          >
            <ChevronLeft className="w-3.5 h-3.5" /> Prev
          </button>
          <span className="text-xs text-zinc-500">Page {page} of {pages} ({total} users)</span>
          <button
            onClick={() => goToPage(page + 1)}
            disabled={page >= pages || loading}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed border border-zinc-800 transition"
          >
            Next <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
};

export default AdminUserManager;
