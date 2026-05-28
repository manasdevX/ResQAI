import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { RefreshCw, MapPin, Clock, AlertTriangle, CheckCircle, Package, Loader2, User } from 'lucide-react';

const TYPE_META = {
  food:     { icon: '🍱', label: 'Food',     color: 'text-orange-400 bg-orange-500/10 border-orange-500/30' },
  water:    { icon: '💧', label: 'Water',    color: 'text-blue-400   bg-blue-500/10   border-blue-500/30'   },
  medical:  { icon: '🏥', label: 'Medical',  color: 'text-red-400    bg-red-500/10    border-red-500/30'    },
  rescue:   { icon: '🚨', label: 'Rescue',   color: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30' },
  shelter:  { icon: '🏠', label: 'Shelter',  color: 'text-purple-400 bg-purple-500/10 border-purple-500/30' },
  clothing: { icon: '👕', label: 'Clothing', color: 'text-cyan-400   bg-cyan-500/10   border-cyan-500/30'   },
};

const URGENCY_STYLE = {
  low:      'text-green-400  bg-green-500/10  border-green-500/30',
  medium:   'text-yellow-400 bg-yellow-500/10 border-yellow-500/30',
  high:     'text-orange-400 bg-orange-500/10 border-orange-500/30',
  critical: 'text-red-400    bg-red-500/10    border-red-500/30',
};

const timeAgo = (d) => {
  const s = Math.floor((Date.now() - new Date(d)) / 1000);
  if (s < 60) return 'Just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return new Date(d).toLocaleDateString('en', { day: 'numeric', month: 'short' });
};

/* ─── Card component ─────────────────────────────────────────────────────────── */
const ResourceCard = ({ req, onAcknowledge, onFulfill, actingId }) => {
  const meta    = TYPE_META[req.type] || { icon: '📦', label: req.type, color: 'text-zinc-400 bg-zinc-700 border-zinc-600' };
  const urgency = URGENCY_STYLE[req.urgency] || URGENCY_STYLE.medium;
  const isAcknowledged = req.status === 'acknowledged';

  return (
    <div className={`p-4 bg-zinc-900 border rounded-2xl transition-all ${
      isAcknowledged ? 'border-yellow-600/30 shadow-sm shadow-yellow-600/5' : 'border-zinc-800 hover:border-zinc-700'
    }`}>
      <div className="flex items-start gap-3">
        {/* Type icon */}
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0 border ${meta.color}`}>
          {meta.icon}
        </div>

        {/* Main content */}
        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${meta.color}`}>
                {meta.label}
              </span>
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${urgency}`}>
                {req.urgency?.toUpperCase()}
              </span>
              {isAcknowledged && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded border text-yellow-400 bg-yellow-500/10 border-yellow-500/30">
                  IN PROGRESS
                </span>
              )}
            </div>
            <p className="text-[10px] text-zinc-600 flex items-center gap-1 shrink-0">
              <Clock className="w-2.5 h-2.5" /> {timeAgo(req.createdAt)}
            </p>
          </div>

          {req.description && (
            <p className="text-sm text-zinc-300 leading-relaxed">{req.description}</p>
          )}

          <div className="flex items-center gap-3 flex-wrap">
            {req.location?.address && (
              <p className="text-xs text-zinc-500 flex items-center gap-1">
                <MapPin className="w-3 h-3 shrink-0" />
                {req.location.address}
              </p>
            )}
            {req.requestedBy?.name && (
              <p className="text-xs text-zinc-600 flex items-center gap-1">
                <User className="w-3 h-3 shrink-0" />
                {req.requestedBy.name}
              </p>
            )}
          </div>

          {/* Acknowledged by */}
          {isAcknowledged && req.acknowledgedBy?.name && (
            <p className="text-[11px] text-yellow-400/70 flex items-center gap-1">
              <CheckCircle className="w-3 h-3" />
              Acknowledged by {req.acknowledgedBy.name}
              {req.acknowledgedAt ? ` · ${timeAgo(req.acknowledgedAt)}` : ''}
            </p>
          )}
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex gap-2 mt-3 pt-3 border-t border-zinc-800/80">
        {!isAcknowledged && (
          <button
            onClick={() => onAcknowledge(req._id)}
            disabled={actingId === req._id}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold text-yellow-400 bg-yellow-600/10 hover:bg-yellow-600/20 border border-yellow-600/30 rounded-xl transition disabled:opacity-50"
          >
            {actingId === req._id
              ? <Loader2 className="w-3 h-3 animate-spin" />
              : <CheckCircle className="w-3 h-3" />
            }
            Acknowledge
          </button>
        )}
        <button
          onClick={() => onFulfill(req._id)}
          disabled={actingId === req._id}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold text-green-400 bg-green-600/10 hover:bg-green-600/20 border border-green-600/30 rounded-xl transition disabled:opacity-50"
        >
          {actingId === req._id && isAcknowledged
            ? <Loader2 className="w-3 h-3 animate-spin" />
            : <CheckCircle className="w-3 h-3" />
          }
          Mark Fulfilled
        </button>
      </div>
    </div>
  );
};

/* ─── Main page ──────────────────────────────────────────────────────────────── */
const VolunteerResources = () => {
  const { api } = useAuth();
  const socket  = useSocket();

  const [requests,   setRequests]   = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState(null);
  const [location,   setLocation]   = useState(null);
  const [radius,     setRadius]     = useState(20);
  const [actingId,   setActingId]   = useState(null);

  /* Fetch */
  const fetchRequests = useCallback(async (loc) => {
    if (!loc) return;
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get(`/resources/nearby?lat=${loc.lat}&lng=${loc.lng}&maxDistance=${radius * 1000}`);
      setRequests(data.requests || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load requests');
    } finally {
      setLoading(false);
    }
  }, [api, radius]);

  /* GPS on mount */
  useEffect(() => {
    if (!navigator.geolocation) { setError('Geolocation not supported'); setLoading(false); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setLocation(loc);
        fetchRequests(loc);
      },
      () => { setError('Location permission denied'); setLoading(false); },
      { timeout: 10000, maximumAge: 60000 }
    );
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* Re-fetch when radius changes */
  useEffect(() => {
    if (location) fetchRequests(location);
  }, [radius, location, fetchRequests]);

  /* Socket.IO real-time */
  useEffect(() => {
    if (!socket) return;
    const onNew = (req) => setRequests(prev => [req, ...prev]);
    const onAcknowledged = ({ requestId, request }) => {
      setRequests(prev => prev.map(r => r._id === requestId ? (request || { ...r, status: 'acknowledged' }) : r));
    };
    const onFulfilled = ({ requestId }) => {
      setRequests(prev => prev.filter(r => r._id !== requestId));
    };
    socket.on('newResourceRequest',          onNew);
    socket.on('resourceRequestAcknowledged', onAcknowledged);
    socket.on('resourceRequestFulfilled',    onFulfilled);
    return () => {
      socket.off('newResourceRequest',          onNew);
      socket.off('resourceRequestAcknowledged', onAcknowledged);
      socket.off('resourceRequestFulfilled',    onFulfilled);
    };
  }, [socket]);

  /* Acknowledge */
  const handleAcknowledge = async (requestId) => {
    setActingId(requestId);
    try {
      const { data } = await api.patch(`/resources/${requestId}/acknowledge`);
      setRequests(prev => prev.map(r => r._id === requestId ? data.request : r));
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to acknowledge');
    } finally {
      setActingId(null);
    }
  };

  /* Fulfill */
  const handleFulfill = async (requestId) => {
    setActingId(requestId);
    try {
      await api.patch(`/resources/${requestId}/fulfill`);
      setRequests(prev => prev.filter(r => r._id !== requestId));
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fulfill');
    } finally {
      setActingId(null);
    }
  };

  const pendingRequests      = requests.filter(r => r.status === 'pending');
  const inProgressRequests   = requests.filter(r => r.status === 'acknowledged');

  return (
    <div className="flex-1 overflow-y-auto p-5 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-lg font-black text-zinc-100">Resource Requests</h1>
          <p className="text-xs text-zinc-500 mt-0.5">
            {location ? `Within ${radius} km of your location` : 'Detecting location…'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={radius}
            onChange={e => setRadius(parseInt(e.target.value))}
            className="bg-zinc-800 border border-zinc-700 rounded-lg text-xs px-2.5 py-1.5 text-zinc-200 focus:outline-none focus:border-blue-500 transition"
          >
            {[5, 10, 20, 50].map(v => <option key={v} value={v}>{v} km</option>)}
          </select>
          <button
            onClick={() => location && fetchRequests(location)}
            disabled={loading}
            className="p-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-zinc-400 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 p-3.5 bg-red-950/40 border border-red-800/40 rounded-xl text-red-400 text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="p-4 bg-zinc-900/80 border border-zinc-800/80 rounded-2xl animate-pulse space-y-3">
              <div className="flex gap-3">
                <div className="w-10 h-10 bg-zinc-800 rounded-xl shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 bg-zinc-800 rounded w-1/3" />
                  <div className="h-3 bg-zinc-800 rounded w-2/3" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : requests.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-zinc-500">
          <Package className="w-12 h-12 mb-4 opacity-20" />
          <p className="text-base font-semibold text-zinc-400">No pending requests</p>
          <p className="text-sm mt-1 text-center">No resource requests near your location right now.</p>
        </div>
      ) : (
        <div className="space-y-6">

          {/* ── In Progress (Acknowledged) section ── */}
          {inProgressRequests.length > 0 && (
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="h-px flex-1 bg-yellow-600/20" />
                <h2 className="text-[11px] font-bold text-yellow-400 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse inline-block" />
                  In Progress ({inProgressRequests.length})
                </h2>
                <div className="h-px flex-1 bg-yellow-600/20" />
              </div>
              {inProgressRequests.map(req => (
                <ResourceCard
                  key={req._id}
                  req={req}
                  onAcknowledge={handleAcknowledge}
                  onFulfill={handleFulfill}
                  actingId={actingId}
                />
              ))}
            </section>
          )}

          {/* ── Pending section ── */}
          {pendingRequests.length > 0 && (
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="h-px flex-1 bg-zinc-700/50" />
                <h2 className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">
                  Pending ({pendingRequests.length})
                </h2>
                <div className="h-px flex-1 bg-zinc-700/50" />
              </div>
              {pendingRequests.map(req => (
                <ResourceCard
                  key={req._id}
                  req={req}
                  onAcknowledge={handleAcknowledge}
                  onFulfill={handleFulfill}
                  actingId={actingId}
                />
              ))}
            </section>
          )}
        </div>
      )}
    </div>
  );
};

export default VolunteerResources;
