import { useEffect, useState, useRef, useCallback } from 'react';
import { useSocket } from '../../context/SocketContext';
import { useAuth } from '../../context/AuthContext';
import LiveMap from '../../components/LiveMap';
import IncidentToast from '../../components/IncidentToast';
import IncidentManagementPanel from '../../components/IncidentManagementPanel';
import WeatherWidget from '../../components/WeatherWidget';

const SEVERITY_COLORS = {
  critical: 'bg-red-500/20 text-red-400 border-red-500/30',
  high:     'bg-orange-500/20 text-orange-400 border-orange-500/30',
  medium:   'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  low:      'bg-green-500/20 text-green-400 border-green-500/30',
};

const TYPE_ICONS = {
  fire: '🔥', flood: '🌊', earthquake: '🌍', cyclone: '🌀',
  landslide: '🏔️', accident: '🚗', medical_emergency: '🚑',
  building_collapse: '🏚️', chemical_spill: '☣️', riot: '⚠️', other: '📍',
};

const AdminDashboard = () => {
  const socket = useSocket();
  const { token, api } = useAuth();

  const [incidents,        setIncidents]        = useState([]);
  const [loading,          setLoading]          = useState(true);
  const [selectedPanel,    setSelectedPanel]    = useState(null);
  const [latestIncidentId, setLatestIncidentId] = useState(null);
  const [toasts,           setToasts]           = useState([]);
  const [newIds,           setNewIds]           = useState(new Set());
  const [globalAlert,      setGlobalAlert]      = useState(null);
  const [sosAlerts,        setSOSAlerts]        = useState([]);

  const sidebarRef = useRef(null);

  useEffect(() => {
    const fetch = async () => {
      try {
        const { data } = await api.get('/incidents');
        if (data.success) setIncidents(data.incidents);
      } catch { /* silent */ } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [api]);

  const dismissToast = useCallback((id) => setToasts(prev => prev.filter(t => t.id !== id)), []);

  useEffect(() => {
    if (!socket) return;

    const handleNew = (incident) => {
      setIncidents(prev => [incident, ...prev]);
      setLatestIncidentId(incident._id);
      const toastId = `toast-${Date.now()}`;
      setToasts(prev => [...prev, { id: toastId, incident }]);
      setNewIds(prev => new Set([...prev, incident._id]));
      setTimeout(() => setNewIds(prev => { const n = new Set(prev); n.delete(incident._id); return n; }), 10000);
      setTimeout(() => sidebarRef.current?.scrollTo({ top: 0, behavior: 'smooth' }), 100);
    };

    const handleUpdated = ({ incidentId, status, severity, assignedResponders }) => {
      setIncidents(prev => prev.map(inc =>
        inc._id === incidentId
          ? { ...inc, ...(status && { status }), ...(severity && { severity }), ...(assignedResponders && { assignedResponders }) }
          : inc
      ));
    };

    const handleAlert = (alert) => {
      setGlobalAlert(alert);
      setTimeout(() => setGlobalAlert(null), 12000);
    };

    const handleSOS = (payload) => {
      setSOSAlerts(prev => [payload, ...prev].slice(0, 5));
      const toastId = `sos-${Date.now()}`;
      setToasts(prev => [...prev, {
        id: toastId,
        incident: { title: `🚨 SOS — ${payload.user?.name}`, description: 'Emergency SOS alert', severity: 'critical', type: 'other' },
      }]);
    };

    socket.on('newIncident',    handleNew);
    socket.on('incidentUpdated', handleUpdated);
    socket.on('alertBroadcast', handleAlert);
    socket.on('sosAlert',       handleSOS);

    return () => {
      socket.off('newIncident',    handleNew);
      socket.off('incidentUpdated', handleUpdated);
      socket.off('alertBroadcast', handleAlert);
      socket.off('sosAlert',       handleSOS);
    };
  }, [socket]);

  const handleIncidentUpdated = useCallback((updated) => {
    setIncidents(prev => prev.map(inc => inc._id === updated._id ? updated : inc));
    setSelectedPanel(updated);
  }, []);

  const activeCount   = incidents.filter(i => !['resolved', 'closed'].includes(i.status)).length;
  const criticalCount = incidents.filter(i => i.severity === 'critical').length;
  const resolvedCount = incidents.filter(i => i.status === 'resolved').length;
  const sosCount      = incidents.filter(i => i.isSOS && !['resolved', 'closed'].includes(i.status)).length;

  return (
    <div className="flex flex-col flex-1 overflow-hidden">

      {/* Toast tray */}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-3 pointer-events-none">
        {toasts.map(({ id, incident }) => (
          <div key={id} className="pointer-events-auto">
            <IncidentToast incident={incident} onDismiss={() => dismissToast(id)} />
          </div>
        ))}
      </div>

      {/* SOS alerts strip */}
      {sosCount > 0 && (
        <div className="flex items-center gap-3 px-5 py-2.5 bg-red-950/90 border-b border-red-800 shrink-0 animate-pulse">
          <span className="text-lg">🚨</span>
          <span className="text-sm font-bold text-red-300">{sosCount} active SOS emergency{sosCount !== 1 ? 'ies' : ''}</span>
          <span className="text-xs text-red-400/70">— SOS incidents are highlighted in the feed below</span>
        </div>
      )}

      {/* Alert banner */}
      {globalAlert && (
        <div className={`relative flex items-start gap-3 px-6 py-3 text-sm font-medium border-b animate-pulse shrink-0 ${
          globalAlert.alertType === 'evacuation' ? 'bg-red-950/80 border-red-800 text-red-200' :
          globalAlert.alertType === 'medical'    ? 'bg-orange-950/80 border-orange-800 text-orange-200' :
          'bg-zinc-800/80 border-zinc-700 text-zinc-200'
        }`}>
          <span className="text-xl shrink-0">
            {globalAlert.alertType === 'evacuation' ? '🚨' : globalAlert.alertType === 'medical' ? '🚑' : '📢'}
          </span>
          <div className="flex-1">
            <span className="font-bold uppercase text-xs opacity-70 mr-2">{globalAlert.alertType} ALERT</span>
            {globalAlert.message}
            <span className="text-xs opacity-50 ml-2">— {globalAlert.broadcastBy}</span>
          </div>
          <button onClick={() => setGlobalAlert(null)} className="text-lg opacity-50 hover:opacity-100 transition">×</button>
        </div>
      )}

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Map */}
        <div className="flex-1 relative">
          {loading ? (
            <div className="w-full h-full flex items-center justify-center bg-zinc-900">
              <div className="flex flex-col items-center gap-3">
                <div className="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-sm text-zinc-400">Loading incident data…</p>
              </div>
            </div>
          ) : (
            <LiveMap incidents={incidents} latestIncidentId={latestIncidentId} />
          )}

          <div className="absolute top-4 left-4 flex items-center gap-2 px-3 py-1.5 bg-zinc-900/90 backdrop-blur-sm rounded-full border border-zinc-700 text-xs font-medium z-10">
            <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            LIVE — {incidents.length} incident{incidents.length !== 1 ? 's' : ''}
          </div>

          <div className="absolute top-4 right-4 z-10">
            <WeatherWidget compact />
          </div>

          {/* Stats bar */}
          <div className="absolute bottom-6 right-4 flex flex-col gap-2 z-10">
            {[
              { label: `${activeCount} Active`,   color: 'bg-green-400' },
              { label: `${criticalCount} Critical`, color: 'bg-red-500' },
              { label: `${resolvedCount} Resolved`, color: 'bg-zinc-400' },
            ].map(({ label, color }) => (
              <div key={label} className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900/90 backdrop-blur-sm rounded-full border border-zinc-700 text-xs font-medium">
                <span className={`w-2 h-2 rounded-full ${color}`} />
                {label}
              </div>
            ))}
          </div>

          {/* Legend */}
          <div className="absolute bottom-6 left-4 bg-zinc-900/90 backdrop-blur-sm border border-zinc-700 rounded-xl p-3 text-xs space-y-1.5 z-10">
            <p className="text-zinc-400 font-semibold uppercase tracking-wider text-[10px] mb-2">Severity</p>
            {[['Critical','bg-red-500'],['High','bg-orange-500'],['Medium','bg-yellow-500'],['Low','bg-green-500']].map(([label, color]) => (
              <div key={label} className="flex items-center gap-2">
                <span className={`w-3 h-3 rounded-full ${color}`} />
                <span className="text-zinc-300">{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Sidebar */}
        <aside className="w-80 xl:w-96 bg-zinc-900 border-l border-zinc-800 flex flex-col overflow-hidden shrink-0">
          <div className="px-4 py-3 border-b border-zinc-800 shrink-0">
            <h2 className="text-sm font-semibold text-zinc-200">Incident Feed</h2>
            <p className="text-xs text-zinc-500 mt-0.5">Real-time via Socket.IO</p>
          </div>

          <div ref={sidebarRef} className="flex-1 overflow-y-auto divide-y divide-zinc-800/60">
            {incidents.length === 0 ? (
              <div className="p-6 text-center text-zinc-500 text-sm">
                <p className="text-2xl mb-2">🛡️</p>
                <p>No incidents reported yet.</p>
              </div>
            ) : (
              incidents.map(inc => {
                const isNew = newIds.has(inc._id);
                return (
                  <button
                    key={inc._id}
                    onClick={() => setSelectedPanel(selectedPanel?._id === inc._id ? null : inc)}
                    className={`w-full text-left px-4 py-3 hover:bg-zinc-800/60 transition group relative ${isNew ? 'bg-zinc-800/40' : ''} ${inc.isSOS ? 'border-l-2 border-red-600' : ''}`}
                  >
                    {isNew && (
                      <span className="absolute top-2 right-2 text-[9px] font-bold px-1.5 py-0.5 bg-red-600 text-white rounded-full animate-pulse">NEW</span>
                    )}

                    <div className="flex items-start gap-2">
                      <span className="text-lg shrink-0">{TYPE_ICONS[inc.type] || '📍'}</span>
                      <div className="flex-1 min-w-0 pr-6">
                        <p className="text-sm font-medium text-zinc-100 truncate">
                          {inc.isSOS && '🚨 '}{inc.title}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${SEVERITY_COLORS[inc.severity]}`}>
                            {inc.severity?.toUpperCase()}
                          </span>
                          <p className="text-xs text-zinc-500 truncate">{inc.description}</p>
                        </div>
                      </div>
                    </div>

                    {selectedPanel?._id === inc._id && (
                      <div className="mt-3 space-y-2">
                        {inc.aiTriage && (
                          <div className="p-3 bg-blue-950/30 border border-blue-900/40 rounded-lg text-left">
                            <p className="text-[11px] font-semibold text-blue-400 mb-1">🤖 AI Triage</p>
                            <p className="text-xs text-blue-200 leading-relaxed">{inc.aiTriage.summary}</p>
                            <div className="flex gap-3 mt-2 text-[10px] text-blue-300">
                              <span>Risk: <strong>{inc.aiTriage.riskScore}/100</strong></span>
                              <span>Affected: <strong>~{inc.aiTriage.estimatedAffected}</strong></span>
                            </div>
                          </div>
                        )}
                        <IncidentManagementPanel incident={inc} token={token} onIncidentUpdated={handleIncidentUpdated} />
                      </div>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </aside>
      </div>
    </div>
  );
};

export default AdminDashboard;
