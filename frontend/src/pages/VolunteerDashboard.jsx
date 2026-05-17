import { useEffect, useState, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { MapPin, RefreshCw, LogOut, Zap, CheckCircle, AlertTriangle, MessageCircle, Home } from 'lucide-react';

const SEVERITY_COLORS = {
  critical: 'bg-red-500/20 text-red-400 border-red-500/30',
  high:     'bg-orange-500/20 text-orange-400 border-orange-500/30',
  medium:   'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  low:      'bg-green-500/20 text-green-400 border-green-500/30',
};

const SEVERITY_BAR = {
  critical: 'bg-red-500',
  high:     'bg-orange-500',
  medium:   'bg-yellow-500',
  low:      'bg-green-500',
};

const TYPE_ICONS = {
  fire: '🔥', flood: '🌊', earthquake: '🌍', cyclone: '🌀',
  landslide: '🏔️', accident: '🚗', medical_emergency: '🚑',
  building_collapse: '🏚️', chemical_spill: '☣️', riot: '⚠️', other: '📍',
};

const STATUS_LABELS = {
  reported:     { label: 'Reported',     color: 'bg-zinc-700 text-zinc-300' },
  acknowledged: { label: 'Acknowledged', color: 'bg-blue-500/20 text-blue-400' },
  responding:   { label: 'Responding',   color: 'bg-yellow-500/20 text-yellow-400' },
  resolved:     { label: 'Resolved',     color: 'bg-green-500/20 text-green-400' },
  closed:       { label: 'Closed',       color: 'bg-zinc-600/40 text-zinc-500' },
};

const haversine = (lat1, lon1, lat2, lon2) => {
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) ** 2;
  return (R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))).toFixed(1);
};

// ── Skeleton card ──────────────────────────────────────────────────────────────
const SkeletonCard = () => (
  <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 animate-pulse space-y-3">
    <div className="flex justify-between">
      <div className="w-10 h-10 skeleton rounded-lg" />
      <div className="w-16 h-5 skeleton rounded-full" />
    </div>
    <div className="w-3/4 h-4 skeleton rounded" />
    <div className="w-1/2 h-3 skeleton rounded" />
    <div className="w-full h-3 skeleton rounded" />
    <div className="w-5/6 h-3 skeleton rounded" />
  </div>
);

// ── Incident card ──────────────────────────────────────────────────────────────
const IncidentCard = ({ inc, user, location, onAccept, accepting }) => {
  const distStr = location && inc.location?.coordinates
    ? `${haversine(location.lat, location.lng, inc.location.coordinates[1], inc.location.coordinates[0])} km`
    : null;

  const isAssigned = inc.assignedResponders?.includes(user?._id);
  const statusStyle = STATUS_LABELS[inc.status] || STATUS_LABELS.reported;

  return (
    <div className="flex flex-col bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden hover:border-zinc-700 transition-all duration-200 animate-fade-up">
      {/* Severity bar */}
      <div className={`h-0.5 w-full ${SEVERITY_BAR[inc.severity] || 'bg-zinc-600'}`} />

      <div className="p-5 flex-1 space-y-3">
        <div className="flex justify-between items-start">
          <span className="text-3xl">{TYPE_ICONS[inc.type] || '📍'}</span>
          <div className="flex flex-col items-end gap-1">
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${SEVERITY_COLORS[inc.severity]}`}>
              {inc.severity?.toUpperCase()}
            </span>
            {distStr && (
              <span className="text-[10px] text-blue-400 flex items-center gap-0.5">
                <MapPin className="w-2.5 h-2.5" /> {distStr} away
              </span>
            )}
          </div>
        </div>

        <div>
          <h3 className="font-bold text-base leading-tight text-zinc-100">{inc.title}</h3>
          <p className="text-xs text-zinc-500 mt-0.5 flex items-center gap-1">
            <MapPin className="w-3 h-3 shrink-0" />
            {inc.location?.address || 'Location unknown'}
          </p>
        </div>

        <p className="text-sm text-zinc-400 line-clamp-3 leading-relaxed">{inc.description}</p>

        {inc.aiTriage?.recommendedActions?.[0] && (
          <div className="bg-blue-950/30 border border-blue-900/30 rounded-lg p-3">
            <p className="text-[10px] font-semibold text-blue-400 mb-1 flex items-center gap-1">
              <Zap className="w-3 h-3" /> AI Recommendation
            </p>
            <p className="text-xs text-blue-200/80 leading-relaxed">{inc.aiTriage.recommendedActions[0]}</p>
          </div>
        )}
      </div>

      <div className="px-5 py-3 bg-zinc-800/20 border-t border-zinc-800 flex items-center justify-between">
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide ${statusStyle.color}`}>
          {statusStyle.label}
        </span>

        {isAssigned ? (
          <span className="text-xs font-semibold text-green-400 flex items-center gap-1.5">
            <CheckCircle className="w-3.5 h-3.5" /> Assigned to you
          </span>
        ) : (
          <button
            onClick={() => onAccept(inc._id)}
            disabled={accepting === inc._id}
            className="text-xs font-semibold px-4 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg transition-all duration-200 hover:scale-105 active:scale-95 flex items-center gap-1.5"
          >
            {accepting === inc._id ? (
              <RefreshCw className="w-3 h-3 animate-spin" />
            ) : '✓'} Accept Task
          </button>
        )}
      </div>
    </div>
  );
};

// ── Main page ──────────────────────────────────────────────────────────────────
const VolunteerDashboard = () => {
  const { user, api, logout } = useAuth();
  const socket = useSocket();

  const [incidents,    setIncidents]    = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState(null);
  const [location,     setLocation]     = useState(null);
  const [radius,       setRadius]       = useState(20);
  const [appliedRadius,setAppliedRadius]= useState(20);
  const [accepting,    setAccepting]    = useState(null);
  const [refreshKey,   setRefreshKey]   = useState(0);
  const locationRef = useRef(null);

  // ── Fetch nearby incidents ─────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    const doFetch = async (lat, lng) => {
      if (!cancelled) { setLoading(true); setError(null); }
      try {
        const { data } = await api.get(
          `/incidents/nearby?lat=${lat}&lng=${lng}&maxDistance=${appliedRadius * 1000}`
        );
        if (!cancelled) setIncidents(data.incidents || []);
      } catch (err) {
        if (!cancelled) setError(err.response?.data?.message || 'Failed to fetch incidents');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    const doGeolocate = async () => {
      if (!navigator.geolocation) {
        if (!cancelled) { setError('Geolocation not supported by your browser'); setLoading(false); }
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          locationRef.current = coords;
          if (!cancelled) setLocation(coords);
          doFetch(coords.lat, coords.lng);
        },
        (err) => {
          const msg = err.code === 1 ? 'Location permission denied'
            : err.code === 3 ? 'Location timed out — please retry'
            : 'Could not get location';
          if (!cancelled) { setError(msg); setLoading(false); }
        },
        { timeout: 10000, maximumAge: 60000, enableHighAccuracy: false }
      );
    };

    if (location) {
      doFetch(location.lat, location.lng);
    } else {
      doGeolocate();
    }

    return () => { cancelled = true; };
  }, [api, location, appliedRadius, refreshKey]);

  // ── Socket real-time updates ───────────────────────────────────────────────
  useEffect(() => {
    if (!socket) return;

    const onUpdated = ({ incidentId, status, severity, assignedResponders }) => {
      setIncidents(prev => prev.map(inc =>
        inc._id === incidentId
          ? { ...inc, ...(status && { status }), ...(severity && { severity }), ...(assignedResponders && { assignedResponders }) }
          : inc
      ));
    };

    const onNew = () => setRefreshKey(k => k + 1);

    socket.on('incidentUpdated', onUpdated);
    socket.on('newIncident',     onNew);
    return () => {
      socket.off('incidentUpdated', onUpdated);
      socket.off('newIncident',     onNew);
    };
  }, [socket]);

  // ── Accept task ────────────────────────────────────────────────────────────
  const handleAccept = useCallback(async (incidentId) => {
    setAccepting(incidentId);
    try {
      const { data } = await api.post(`/incidents/${incidentId}/accept`);
      setIncidents(prev => prev.map(inc => inc._id === incidentId ? data.incident : inc));
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to accept task');
    } finally {
      setAccepting(null);
    }
  }, [api]);

  const activeCount   = incidents.filter(i => !['resolved', 'closed'].includes(i.status)).length;
  const criticalCount = incidents.filter(i => i.severity === 'critical').length;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col page-enter">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-20 flex items-center justify-between px-4 sm:px-6 py-3 bg-zinc-900/90 backdrop-blur-sm border-b border-zinc-800">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-sm font-bold shrink-0">V</div>
          <div>
            <h1 className="text-sm font-bold leading-none">ResQAI Volunteer</h1>
            <p className="text-[10px] text-zinc-500 mt-0.5">Field Response Dashboard</p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {/* Quick stats */}
          <div className="hidden sm:flex items-center gap-2">
            {criticalCount > 0 && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-red-500/10 border border-red-500/20 rounded-full text-xs text-red-400 animate-pulse-slow">
                <AlertTriangle className="w-3 h-3" /> {criticalCount} critical
              </div>
            )}
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-zinc-800 rounded-full text-xs text-zinc-400">
              {activeCount} active
            </div>
          </div>

          <Link to="/chat" className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 transition" title="Open chat">
            <MessageCircle className="w-4 h-4 text-zinc-400" />
          </Link>
          <Link to="/dashboard" className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 transition" title="Admin dashboard">
            <Home className="w-4 h-4 text-zinc-400" />
          </Link>
          <span className="text-sm text-zinc-500 hidden md:block">Hi, {user?.name?.split(' ')[0]}</span>
          <button onClick={logout}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-zinc-800 hover:bg-red-900/40 hover:text-red-400 hover:border-red-800 rounded-lg border border-zinc-700 transition">
            <LogOut className="w-3.5 h-3.5" /> Logout
          </button>
        </div>
      </header>

      {/* ── Main ────────────────────────────────────────────────────────────── */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-6 space-y-5">

        {/* Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 sm:p-5 bg-zinc-900 border border-zinc-800 rounded-xl">
          <div>
            <h2 className="text-lg font-bold flex items-center gap-2">
              Nearby Incidents
              {loading && <RefreshCw className="w-4 h-4 text-zinc-500 animate-spin" />}
            </h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              {location
                ? `Showing emergencies within ${appliedRadius} km of your location`
                : 'Detecting your location…'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-zinc-500 font-medium uppercase tracking-wide">Radius</label>
              <select
                value={radius}
                onChange={e => {
                  const v = parseInt(e.target.value);
                  setRadius(v);
                  setAppliedRadius(v);
                }}
                className="bg-zinc-800 border border-zinc-700 rounded-lg text-sm px-3 py-1.5 focus:outline-none focus:border-blue-500 transition text-zinc-200 cursor-pointer"
              >
                {[5, 10, 20, 50, 100].map(v => (
                  <option key={v} value={v}>{v} km</option>
                ))}
              </select>
            </div>

            <button
              onClick={() => setRefreshKey(k => k + 1)}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg text-sm font-semibold transition-all hover:scale-105 active:scale-95 mt-auto"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* Error banner */}
        {error && (
          <div className="flex items-center gap-3 p-4 bg-red-950/40 border border-red-900/50 rounded-xl text-red-400 text-sm animate-fade-up">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span className="flex-1">{error}</span>
            <button onClick={() => setError(null)} className="text-red-500 hover:text-red-300 text-xs underline shrink-0">Dismiss</button>
          </div>
        )}

        {/* Cards grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : incidents.length === 0 && !error ? (
          <div className="flex flex-col items-center justify-center py-20 text-zinc-500 bg-zinc-900/30 rounded-xl border border-zinc-800 border-dashed animate-fade-in">
            <span className="text-5xl mb-4">🙌</span>
            <p className="text-lg font-semibold text-zinc-300">All clear!</p>
            <p className="text-sm mt-1">No active incidents within {appliedRadius} km.</p>
            <button onClick={() => setRefreshKey(k => k + 1)}
              className="mt-4 flex items-center gap-1.5 text-sm text-blue-400 hover:text-blue-300 transition">
              <RefreshCw className="w-3.5 h-3.5" /> Check again
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 stagger">
            {incidents.map(inc => (
              <IncidentCard
                key={inc._id}
                inc={inc}
                user={user}
                location={location}
                onAccept={handleAccept}
                accepting={accepting}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default VolunteerDashboard;
