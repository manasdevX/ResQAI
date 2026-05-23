import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { RefreshCw, AlertTriangle, Search, Filter, X, ChevronDown, ChevronLeft, ChevronRight, MapPin, Clock, Users } from 'lucide-react';
import IncidentManagementPanel from '../../components/IncidentManagementPanel';

import { INCIDENT_TYPES, TYPE_ICONS, SEVERITY_BADGE, SEVERITY_DOT, INCIDENT_STATUS } from '../../constants/incident';

const TYPES   = INCIDENT_TYPES.map(t => t.value);
const PAGE_LIMIT = 30;

const AdminIncidentManager = () => {
  const { token, api } = useAuth();
  const socket = useSocket();

  const [incidents,    setIncidents]    = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState(null);
  const [selected,     setSelected]     = useState(null);
  const [search,       setSearch]       = useState('');
  const [filterSev,    setFilterSev]    = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterType,   setFilterType]   = useState('all');
  const [sortBy,       setSortBy]       = useState('newest');
  const [showFilters,  setShowFilters]  = useState(false);

  // Pagination
  const [page,  setPage]  = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);

  // Debounce ref for filter changes
  const fetchRef = useRef(null);

  const buildQuery = useCallback((pg = page) => {
    const params = new URLSearchParams();
    params.set('page',  String(pg));
    params.set('limit', String(PAGE_LIMIT));
    if (filterSev    !== 'all') params.set('severity', filterSev);
    if (filterStatus !== 'all') params.set('status',   filterStatus);
    if (filterType   !== 'all') params.set('type',     filterType);
    return `/incidents?${params.toString()}`;
  }, [page, filterSev, filterStatus, filterType]);

  const fetch = useCallback(async (pg = page) => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get(buildQuery(pg));
      if (data.success) {
        setIncidents(data.incidents || []);
        setTotal(data.total  || 0);
        setPages(data.pages  || 1);
        setPage(pg);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load incidents');
    } finally {
      setLoading(false);
    }
  }, [api, buildQuery, page]);

  // Re-fetch when filters change — reset to page 1
  useEffect(() => {
    clearTimeout(fetchRef.current);
    fetchRef.current = setTimeout(() => fetch(1), 150);
    return () => clearTimeout(fetchRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterSev, filterStatus, filterType, sortBy]);

  // Initial load
  useEffect(() => { fetch(1); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!socket) return;
    const onNew     = (inc) => {
      // Prepend to current list only if it matches active filters
      const matchesSev    = filterSev    === 'all' || inc.severity === filterSev;
      const matchesStatus = filterStatus === 'all' || inc.status   === filterStatus;
      const matchesType   = filterType   === 'all' || inc.type     === filterType;
      if (matchesSev && matchesStatus && matchesType) {
        setIncidents(prev => [inc, ...prev]);
        setTotal(prev => prev + 1);
      }
    };
    const onUpdated = ({ incidentId, status, severity, assignedResponders }) => {
      setIncidents(prev => prev.map(i =>
        i._id === incidentId
          ? { ...i, ...(status && { status }), ...(severity && { severity }), ...(assignedResponders && { assignedResponders }) }
          : i
      ));
    };
    socket.on('newIncident',     onNew);
    socket.on('incidentUpdated', onUpdated);
    return () => {
      socket.off('newIncident',     onNew);
      socket.off('incidentUpdated', onUpdated);
    };
  }, [socket, filterSev, filterStatus, filterType]);

  const handleUpdated = useCallback((updated) => {
    setIncidents(prev => prev.map(i => i._id === updated._id ? updated : i));
    setSelected(updated);
  }, []);

  // Client-side text search within the current page's data
  const displayed = incidents.filter(i => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      i.title?.toLowerCase().includes(q) ||
      i.description?.toLowerCase().includes(q) ||
      i.location?.address?.toLowerCase().includes(q)
    );
  }).sort((a, b) => {
    if (sortBy === 'newest')   return new Date(b.createdAt) - new Date(a.createdAt);
    if (sortBy === 'oldest')   return new Date(a.createdAt) - new Date(b.createdAt);
    if (sortBy === 'severity') {
      const order = { critical: 0, high: 1, medium: 2, low: 3 };
      return (order[a.severity] ?? 4) - (order[b.severity] ?? 4);
    }
    return 0;
  });

  const activeCount   = incidents.filter(i => !['resolved', 'closed'].includes(i.status)).length;
  const criticalCount = incidents.filter(i => i.severity === 'critical').length;
  const sosCount      = incidents.filter(i => i.isSOS && !['resolved', 'closed'].includes(i.status)).length;

  const goToPage = (pg) => {
    if (pg < 1 || pg > pages || pg === page) return;
    fetch(pg);
  };

  return (
    <div className="flex flex-col flex-1 overflow-hidden">

      {/* Header */}
      <div className="px-6 py-4 border-b border-zinc-800 bg-zinc-900/50 shrink-0">
        <div className="flex items-center justify-between gap-4 mb-4">
          <div>
            <h1 className="text-lg font-black text-zinc-100">Incident Manager</h1>
            <p className="text-xs text-zinc-500 mt-0.5">
              {total} incident{total !== 1 ? 's' : ''} total — page {page} of {pages}
            </p>
          </div>
          <button
            onClick={() => fetch(page)}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg text-xs font-medium text-zinc-300 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>

        {/* Stat chips */}
        <div className="flex gap-2 flex-wrap">
          {[
            { label: `${total} Total`,           color: 'bg-zinc-800 text-zinc-300 border-zinc-700' },
            { label: `${activeCount} Active`,    color: 'bg-green-500/10 text-green-400 border-green-500/20' },
            { label: `${criticalCount} Critical`, color: 'bg-red-500/10 text-red-400 border-red-500/20' },
            ...(sosCount > 0 ? [{ label: `🚨 ${sosCount} SOS`, color: 'bg-red-600/20 text-red-300 border-red-600/30 animate-pulse' }] : []),
          ].map(({ label, color }) => (
            <span key={label} className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${color}`}>{label}</span>
          ))}
        </div>
      </div>

      {/* Search + filter bar */}
      <div className="px-6 py-3 border-b border-zinc-800 shrink-0 space-y-2">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500 pointer-events-none" />
            <input
              type="text"
              placeholder="Search within page…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-blue-500 transition"
            />
            {search && <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2"><X className="w-4 h-4 text-zinc-500 hover:text-zinc-300" /></button>}
          </div>

          <div className="relative">
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value)}
              className="appearance-none bg-zinc-800 border border-zinc-700 rounded-lg text-xs px-3 py-2 pr-7 text-zinc-300 focus:outline-none focus:border-blue-500 transition"
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="severity">Most critical</option>
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500 pointer-events-none" />
          </div>

          <button
            onClick={() => setShowFilters(f => !f)}
            className={`flex items-center gap-1.5 px-3 py-2 border rounded-lg text-xs font-medium transition ${
              showFilters || filterSev !== 'all' || filterStatus !== 'all' || filterType !== 'all'
                ? 'bg-blue-600/20 border-blue-500/40 text-blue-300'
                : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:bg-zinc-700'
            }`}
          >
            <Filter className="w-3.5 h-3.5" /> Filters
            {(filterSev !== 'all' || filterStatus !== 'all' || filterType !== 'all') && (
              <span className="w-1.5 h-1.5 bg-blue-400 rounded-full" />
            )}
          </button>
        </div>

        {showFilters && (
          <div className="flex gap-4 flex-wrap text-xs">
            <div>
              <p className="text-zinc-500 mb-1 font-medium">Severity</p>
              <div className="flex gap-1">
                {['all', 'critical', 'high', 'medium', 'low'].map(s => (
                  <button key={s} onClick={() => setFilterSev(s)}
                    className={`px-2 py-0.5 rounded-full border capitalize transition ${filterSev === s ? 'bg-blue-600 border-blue-500 text-white' : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-500'}`}>
                    {s === 'all' ? 'All' : s}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-zinc-500 mb-1 font-medium">Status</p>
              <div className="flex gap-1 flex-wrap">
                {['all', 'reported', 'acknowledged', 'responding', 'resolved', 'closed'].map(s => (
                  <button key={s} onClick={() => setFilterStatus(s)}
                    className={`px-2 py-0.5 rounded-full border capitalize transition ${filterStatus === s ? 'bg-blue-600 border-blue-500 text-white' : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-500'}`}>
                    {s === 'all' ? 'All' : s}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-zinc-500 mb-1 font-medium">Type</p>
              <div className="flex gap-1 flex-wrap">
                {['all', ...TYPES].map(t => (
                  <button key={t} onClick={() => setFilterType(t)}
                    className={`px-2 py-0.5 rounded-full border transition ${filterType === t ? 'bg-blue-600 border-blue-500 text-white' : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-500'}`}>
                    {t === 'all' ? 'All' : (TYPE_ICONS[t] || '') + ' ' + t.replace('_', ' ')}
                  </button>
                ))}
              </div>
            </div>
            {(filterSev !== 'all' || filterStatus !== 'all' || filterType !== 'all') && (
              <button
                onClick={() => { setFilterSev('all'); setFilterStatus('all'); setFilterType('all'); }}
                className="self-end text-xs text-zinc-500 hover:text-red-400 transition flex items-center gap-1"
              >
                <X className="w-3 h-3" /> Clear filters
              </button>
            )}
          </div>
        )}
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">

        {/* Incident list */}
        <div className="w-[420px] xl:w-[480px] shrink-0 flex flex-col border-r border-zinc-800">
          {error && (
            <div className="m-4 flex items-center gap-2 p-3 bg-red-950/40 border border-red-800/40 rounded-xl text-red-400 text-sm">
              <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
            </div>
          )}

          {/* Scrollable incident list */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="p-4 space-y-3">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="p-4 bg-zinc-900 border border-zinc-800 rounded-xl animate-pulse space-y-2">
                    <div className="h-4 bg-zinc-800 rounded w-3/4" />
                    <div className="h-3 bg-zinc-800 rounded w-1/2" />
                  </div>
                ))}
              </div>
            ) : displayed.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-zinc-500">
                <span className="text-4xl mb-3">🛡️</span>
                <p className="text-sm font-semibold text-zinc-400">No incidents match</p>
                <p className="text-xs mt-1">Try clearing filters or search</p>
              </div>
            ) : (
              <div className="divide-y divide-zinc-800/60">
                {displayed.map(inc => (
                  <button
                    key={inc._id}
                    onClick={() => setSelected(selected?._id === inc._id ? null : inc)}
                    className={`w-full text-left px-4 py-3.5 hover:bg-zinc-800/50 transition group relative ${
                      selected?._id === inc._id ? 'bg-zinc-800/60 border-l-2 border-blue-500' :
                      inc.isSOS ? 'border-l-2 border-red-600' : ''
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${SEVERITY_DOT[inc.severity] || 'bg-zinc-500'}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-semibold text-zinc-100 leading-tight truncate">
                            {inc.isSOS && '🚨 '}{TYPE_ICONS[inc.type] || '📍'} {inc.title}
                          </p>
                          <span className={`shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded border ${SEVERITY_BADGE[inc.severity]}`}>
                            {inc.severity?.toUpperCase()}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${INCIDENT_STATUS[inc.status]?.color}`}>
                            {inc.status}
                          </span>
                          {inc.location?.address && (
                            <span className="flex items-center gap-1 text-[10px] text-zinc-600">
                              <MapPin className="w-2.5 h-2.5" /> {inc.location.address}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-3 mt-1.5 text-[10px] text-zinc-600">
                          <span className="flex items-center gap-1">
                            <Clock className="w-2.5 h-2.5" />
                            {new Date(inc.createdAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </span>
                          {inc.assignedResponders?.length > 0 && (
                            <span className="flex items-center gap-1 text-blue-400">
                              <Users className="w-2.5 h-2.5" /> {inc.assignedResponders.length} assigned
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Pagination controls */}
          {pages > 1 && (
            <div className="shrink-0 flex items-center justify-between px-4 py-2.5 border-t border-zinc-800 bg-zinc-900/80">
              <button
                onClick={() => goToPage(page - 1)}
                disabled={page <= 1 || loading}
                className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed transition"
              >
                <ChevronLeft className="w-3.5 h-3.5" /> Prev
              </button>

              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(pages, 7) }, (_, i) => {
                  let pg;
                  if (pages <= 7) {
                    pg = i + 1;
                  } else if (page <= 4) {
                    pg = i < 5 ? i + 1 : i === 5 ? '…' : pages;
                  } else if (page >= pages - 3) {
                    pg = i === 0 ? 1 : i === 1 ? '…' : pages - 6 + i;
                  } else {
                    pg = i === 0 ? 1 : i === 1 ? '…' : i === 5 ? '…' : i === 6 ? pages : page + i - 3;
                  }
                  if (pg === '…') {
                    return <span key={`ellipsis-${i}`} className="text-zinc-600 text-xs px-1">…</span>;
                  }
                  return (
                    <button
                      key={pg}
                      onClick={() => goToPage(pg)}
                      disabled={loading}
                      className={`w-6 h-6 rounded text-[11px] font-semibold transition ${
                        pg === page ? 'bg-blue-600 text-white' : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
                      }`}
                    >
                      {pg}
                    </button>
                  );
                })}
              </div>

              <button
                onClick={() => goToPage(page + 1)}
                disabled={page >= pages || loading}
                className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed transition"
              >
                Next <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Management panel */}
        <div className="flex-1 overflow-y-auto">
          {selected ? (
            <div className="p-6 space-y-4 max-w-2xl">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs text-zinc-500 uppercase tracking-wider font-semibold mb-1">Managing Incident</p>
                  <h2 className="text-base font-bold text-zinc-100">{selected.isSOS && '🚨 '}{selected.title}</h2>
                  <p className="text-xs text-zinc-500 mt-0.5">{selected.description}</p>
                </div>
                <button onClick={() => setSelected(null)} className="p-1 hover:bg-zinc-800 rounded-lg transition">
                  <X className="w-4 h-4 text-zinc-500" />
                </button>
              </div>

              {selected.aiTriage && (
                <div className="p-4 bg-blue-950/30 border border-blue-900/40 rounded-xl">
                  <p className="text-xs font-bold text-blue-400 mb-2">🤖 AI Triage Analysis</p>
                  <p className="text-sm text-blue-200 leading-relaxed">{selected.aiTriage.summary}</p>
                  <div className="flex gap-4 mt-3 text-xs text-blue-300">
                    <span>Risk Score: <strong>{selected.aiTriage.riskScore}/100</strong></span>
                    <span>Est. Affected: <strong>~{selected.aiTriage.estimatedAffected}</strong></span>
                  </div>
                  {selected.aiTriage.recommendedActions?.length > 0 && (
                    <div className="mt-3">
                      <p className="text-xs font-semibold text-blue-400 mb-1.5">Recommended Actions:</p>
                      <ul className="space-y-1">
                        {selected.aiTriage.recommendedActions.map((action, i) => (
                          <li key={i} className="flex items-start gap-2 text-xs text-blue-200/80">
                            <span className="text-blue-500 shrink-0 mt-0.5">•</span>{action}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              <IncidentManagementPanel
                incident={selected}
                token={token}
                onIncidentUpdated={handleUpdated}
              />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-zinc-600">
              <span className="text-5xl mb-4">👈</span>
              <p className="text-sm font-semibold text-zinc-400">Select an incident</p>
              <p className="text-xs mt-1">Click any incident from the list to manage it</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminIncidentManager;
