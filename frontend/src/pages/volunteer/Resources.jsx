import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { RefreshCw, MapPin, Clock, AlertTriangle, CheckCircle, Package } from 'lucide-react';

const TYPE_ICONS = {
  food:     { icon: '🍱', label: 'Food',     color: 'text-orange-400 bg-orange-500/10 border-orange-500/30' },
  water:    { icon: '💧', label: 'Water',    color: 'text-blue-400 bg-blue-500/10 border-blue-500/30' },
  medical:  { icon: '🏥', label: 'Medical',  color: 'text-red-400 bg-red-500/10 border-red-500/30' },
  rescue:   { icon: '🚨', label: 'Rescue',   color: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30' },
  shelter:  { icon: '🏠', label: 'Shelter',  color: 'text-purple-400 bg-purple-500/10 border-purple-500/30' },
  clothing: { icon: '👕', label: 'Clothing', color: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30' },
};

const URGENCY_COLORS = {
  low:      'text-green-400 bg-green-500/10 border-green-500/30',
  medium:   'text-yellow-400 bg-yellow-500/10 border-yellow-500/30',
  high:     'text-orange-400 bg-orange-500/10 border-orange-500/30',
  critical: 'text-red-400 bg-red-500/10 border-red-500/30',
};

const VolunteerResources = () => {
  const { api } = useAuth();
  const socket  = useSocket();

  const [requests,  setRequests]  = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);
  const [location,  setLocation]  = useState(null);
  const [radius,    setRadius]    = useState(20);
  const [fulfilling, setFulfilling] = useState(null);

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
  }, []);

  useEffect(() => {
    if (location) fetchRequests(location);
  }, [radius, location, fetchRequests]);

  useEffect(() => {
    if (!socket) return;
    const onNew = (req) => setRequests(prev => [req, ...prev]);
    const onFulfilled = ({ requestId }) => {
      setRequests(prev => prev.filter(r => r._id !== requestId));
    };
    socket.on('newResourceRequest',       onNew);
    socket.on('resourceRequestFulfilled', onFulfilled);
    return () => {
      socket.off('newResourceRequest',       onNew);
      socket.off('resourceRequestFulfilled', onFulfilled);
    };
  }, [socket]);

  const handleFulfill = async (requestId) => {
    setFulfilling(requestId);
    try {
      await api.patch(`/resources/${requestId}/fulfill`);
      setRequests(prev => prev.filter(r => r._id !== requestId));
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fulfill');
    } finally {
      setFulfilling(null);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-5 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-lg font-black text-zinc-100">Resource Requests</h1>
          <p className="text-xs text-zinc-500 mt-0.5">
            {location ? `Pending requests within ${radius} km` : 'Detecting location…'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={radius}
            onChange={e => { setRadius(parseInt(e.target.value)); }}
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

      {error && (
        <div className="flex items-center gap-2 p-3.5 bg-red-950/40 border border-red-800/40 rounded-xl text-red-400 text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2].map(i => (
            <div key={i} className="p-4 bg-zinc-900 border border-zinc-800 rounded-2xl animate-pulse space-y-2">
              <div className="h-4 bg-zinc-800 rounded w-1/2" />
              <div className="h-3 bg-zinc-800 rounded w-3/4" />
            </div>
          ))}
        </div>
      ) : requests.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-zinc-500">
          <Package className="w-10 h-10 mb-3 opacity-30" />
          <p className="text-base font-semibold text-zinc-400">No pending requests</p>
          <p className="text-sm mt-1 text-center">No resource requests near your location right now.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map(req => {
            const typeInfo = TYPE_ICONS[req.type] || { icon: '📦', label: req.type, color: 'text-zinc-400 bg-zinc-700 border-zinc-600' };

            return (
              <div key={req._id} className="p-4 bg-zinc-900 border border-zinc-800 rounded-2xl hover:border-zinc-700 transition-all">
                <div className="flex items-start gap-3">
                  <span className="text-2xl shrink-0">{typeInfo.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${typeInfo.color}`}>
                        {typeInfo.label}
                      </span>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${URGENCY_COLORS[req.urgency]}`}>
                        {req.urgency?.toUpperCase()}
                      </span>
                    </div>

                    {req.description && (
                      <p className="text-sm text-zinc-400 leading-relaxed mt-1">{req.description}</p>
                    )}

                    <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-zinc-600">
                      {req.requestedBy?.name && <span className="font-medium text-zinc-500">By {req.requestedBy.name}</span>}
                      {req.requestedBy?.phone && <span>{req.requestedBy.phone}</span>}
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(req.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {req.location?.address && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" /> {req.location.address}
                        </span>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={() => handleFulfill(req._id)}
                    disabled={fulfilling === req._id}
                    className="shrink-0 flex items-center gap-1.5 px-3 py-2 bg-green-600/20 hover:bg-green-600/30 border border-green-600/30 text-green-400 rounded-xl text-xs font-bold transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
                  >
                    {fulfilling === req._id ? <RefreshCw className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />}
                    Fulfill
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default VolunteerResources;
