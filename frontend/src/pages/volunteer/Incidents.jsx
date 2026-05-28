import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { MapPin, RefreshCw, AlertTriangle, CheckCircle, Zap } from 'lucide-react';

import { SEVERITY_BADGE, SEVERITY_DOT, TYPE_ICONS, INCIDENT_STATUS } from '../../constants/incident';

const haversine = (lat1, lon1, lat2, lon2) => {
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return (R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))).toFixed(1);
};

const VolunteerIncidents = () => {
  const { user, api } = useAuth();
  const socket = useSocket();

  const [incidents,      setIncidents]      = useState([]);
  const [loading,        setLoading]        = useState(true);
  const [error,          setError]          = useState(null);
  const [location,       setLocation]       = useState(null);
  const [radius,         setRadius]         = useState(20);
  const [accepting,      setAccepting]      = useState(null);
  const [refreshKey,     setRefreshKey]     = useState(0);
  const [filterSeverity, setFilterSeverity] = useState('all');
  const locationRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    const doFetch = async (lat, lng) => {
      if (!cancelled) { setLoading(true); setError(null); }
      try {
        const { data } = await api.get(`/incidents/nearby?lat=${lat}&lng=${lng}&maxDistance=${radius * 1000}`);
        if (!cancelled) setIncidents(data.incidents || []);
      } catch (err) {
        if (!cancelled) setError(err.response?.data?.message || 'Failed to fetch incidents');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    if (location) {
      doFetch(location.lat, location.lng);
    } else {
      if (!navigator.geolocation) { setError('Geolocation not supported'); setLoading(false); return; }
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          locationRef.current = coords;
          if (!cancelled) setLocation(coords);
          doFetch(coords.lat, coords.lng);
        },
        (err) => {
          const msg = err.code === 1 ? 'Location permission denied' : 'Could not get location';
          if (!cancelled) { setError(msg); setLoading(false); }
        },
        { timeout: 10000, maximumAge: 60000 }
      );
    }

    return () => { cancelled = true; };
  }, [api, location, radius, refreshKey]);

  useEffect(() => {
    if (!socket) return;
    const onUpdated = ({ incidentId, status, severity, assignedResponders }) => {
      setIncidents(prev => prev.map(inc =>
        inc._id === incidentId ? { ...inc, ...(status && { status }), ...(severity && { severity }), ...(assignedResponders && { assignedResponders }) } : inc
      ));
    };
    const onNew = () => setRefreshKey(k => k + 1);
    socket.on('incidentUpdated', onUpdated);
    socket.on('newIncident', onNew);
    return () => { socket.off('incidentUpdated', onUpdated); socket.off('newIncident', onNew); };
  }, [socket]);

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

  const displayed = filterSeverity === 'all' ? incidents : incidents.filter(i => i.severity === filterSeverity);

  return (
    <div className="flex-1 overflow-y-auto p-5 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-lg font-black text-zinc-100">Nearby Incidents</h1>
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
            {[5, 10, 20, 50, 100].map(v => <option key={v} value={v}>{v} km</option>)}
          </select>
          <button
            onClick={() => setRefreshKey(k => k + 1)}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg text-xs font-semibold transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
      </div>

      {/* Severity filter */}
      <div className="flex gap-1.5">
        {['all', 'critical', 'high', 'medium', 'low'].map(s => (
          <button
            key={s}
            onClick={() => setFilterSeverity(s)}
            className={`px-2.5 py-1 rounded-full text-[10px] font-bold border transition capitalize ${
              filterSeverity === s ? 'bg-blue-600 border-blue-500 text-white' : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-500'
            }`}
          >
            {s === 'all' ? 'All' : s}
          </button>
        ))}
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3.5 bg-red-950/40 border border-red-800/40 rounded-xl text-red-400 text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
          <button onClick={() => setError(null)} className="ml-auto text-xs underline">Dismiss</button>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 gap-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="p-4 bg-zinc-900/80 border border-zinc-800/80 rounded-2xl animate-pulse space-y-3">
              <div className="h-4 bg-zinc-800 rounded w-3/4" />
              <div className="h-3 bg-zinc-800 rounded w-1/2" />
              <div className="h-10 bg-zinc-800 rounded" />
            </div>
          ))}
        </div>
      ) : displayed.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-zinc-500">
          <span className="text-4xl mb-3">🙌</span>
          <p className="text-base font-semibold text-zinc-400">All clear!</p>
          <p className="text-sm mt-1">No active incidents within {radius} km.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {displayed.map(inc => {
            const isAssigned = inc.assignedResponders?.some(r => (r?._id?.toString() || r?.toString()) === user?._id?.toString());
            const distStr = location && inc.location?.coordinates
              ? `${haversine(location.lat, location.lng, inc.location.coordinates[1], inc.location.coordinates[0])} km`
              : null;
            const statusStyle = INCIDENT_STATUS[inc.status] || INCIDENT_STATUS.reported;

            return (
              <div key={inc._id} className={`bg-zinc-900 border rounded-2xl overflow-hidden transition-all ${inc.isSOS ? 'border-red-600/60 shadow-lg shadow-red-600/10' : 'border-zinc-800 hover:border-zinc-700'}`}>
                <div className={`h-0.5 w-full ${SEVERITY_DOT[inc.severity] || 'bg-zinc-700'}`} />

                <div className="p-4 space-y-3">
                  {inc.isSOS && (
                    <div className="flex items-center gap-2 text-xs font-bold text-red-400 bg-red-950/40 border border-red-700/30 px-2.5 py-1.5 rounded-lg">
                      🚨 SOS EMERGENCY — Respond immediately
                    </div>
                  )}

                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2.5 flex-1 min-w-0">
                      <span className="text-xl shrink-0 mt-0.5">{TYPE_ICONS[inc.type] || '📍'}</span>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-zinc-100 leading-tight">{inc.title}</p>
                        <p className="text-xs text-zinc-500 mt-0.5 flex items-center gap-1">
                          <MapPin className="w-2.5 h-2.5 shrink-0" />
                          {inc.location?.address || 'Location unknown'}
                          {distStr && <span className="text-blue-400 ml-1">· {distStr} away</span>}
                        </p>
                      </div>
                    </div>
                    <span className={`shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded border ${SEVERITY_BADGE[inc.severity]}`}>
                      {inc.severity?.toUpperCase()}
                    </span>
                  </div>

                  <p className="text-sm text-zinc-400 line-clamp-2 leading-relaxed">{inc.description}</p>

                  {inc.aiTriage?.recommendedActions?.[0] && (
                    <div className="p-2.5 bg-blue-950/30 border border-blue-900/30 rounded-xl">
                      <p className="text-[10px] font-bold text-blue-400 mb-1 flex items-center gap-1">
                        <Zap className="w-3 h-3" /> AI Recommendation
                      </p>
                      <p className="text-xs text-blue-200/80">{inc.aiTriage.recommendedActions[0]}</p>
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${statusStyle.color}`}>
                      {statusStyle.label}
                    </span>

                    {isAssigned ? (
                      <span className="text-xs font-semibold text-green-400 flex items-center gap-1.5">
                        <CheckCircle className="w-3.5 h-3.5" /> Assigned to you
                      </span>
                    ) : (
                      <button
                        onClick={() => handleAccept(inc._id)}
                        disabled={accepting === inc._id}
                        className="flex items-center gap-1.5 text-xs font-semibold px-4 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg transition-all hover:scale-105 active:scale-95"
                      >
                        {accepting === inc._id ? <RefreshCw className="w-3 h-3 animate-spin" /> : '✓'} Accept Task
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default VolunteerIncidents;
