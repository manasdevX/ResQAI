import { useEffect, useState, useRef, useCallback } from 'react';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';
import LiveMap from '../components/LiveMap';
import IncidentToast from '../components/IncidentToast';
import IncidentManagementPanel from '../components/IncidentManagementPanel';
import axios from 'axios';

const SEVERITY_COLORS = {
  critical: 'bg-red-500/20 text-red-400 border-red-500/30',
  high:     'bg-orange-500/20 text-orange-400 border-orange-500/30',
  medium:   'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  low:      'bg-green-500/20 text-green-400 border-green-500/30',
};

const TYPE_ICONS = {
  fire:               '🔥',
  flood:              '🌊',
  earthquake:         '🌍',
  cyclone:            '🌀',
  landslide:          '🏔️',
  accident:           '🚗',
  medical_emergency:  '🚑',
  building_collapse:  '🏚️',
  chemical_spill:     '☣️',
  riot:               '⚠️',
  other:              '📍',
};

const Dashboard = () => {
  const socket = useSocket();
  const { token, user, logout } = useAuth();

  const [incidents, setIncidents]               = useState([]);
  const [loading, setLoading]                   = useState(true);
  const [selectedPanel, setSelectedPanel]       = useState(null);
  const [latestIncidentId, setLatestIncidentId] = useState(null);
  const [toasts, setToasts]                     = useState([]);
  const [newIds, setNewIds]                     = useState(new Set());
  const [globalAlert, setGlobalAlert]           = useState(null); // alertBroadcast payload

  const sidebarRef    = useRef(null);
  const incidentRefs  = useRef({});

  // ── Fetch existing incidents on mount ──────────────────────────────────────
  useEffect(() => {
    const fetchIncidents = async () => {
      try {
        const { data } = await axios.get('http://localhost:5000/api/incidents', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (data.success) setIncidents(data.incidents);
      } catch (err) {
        console.error('Failed to fetch incidents:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchIncidents();
  }, [token]);

  // ── Dismiss a toast by its temp id ────────────────────────────────────────
  const dismissToast = useCallback((toastId) => {
    setToasts(prev => prev.filter(t => t.id !== toastId));
  }, []);

  // ── Real-time: listen for new incidents ───────────────────────────────────
  useEffect(() => {
    if (!socket) return;

    const handleNewIncident = (incident) => {
      // 1. Prepend to incident list
      setIncidents(prev => [incident, ...prev]);

      // 2. Tell the map which incident is new (triggers auto-pan + pulse)
      setLatestIncidentId(incident._id);

      // 3. Show toast notification
      const toastId = `toast-${Date.now()}`;
      setToasts(prev => [...prev, { id: toastId, incident }]);

      // 4. Mark as NEW for 10 seconds for the sidebar badge
      setNewIds(prev => new Set([...prev, incident._id]));
      setTimeout(() => {
        setNewIds(prev => {
          const next = new Set(prev);
          next.delete(incident._id);
          return next;
        });
      }, 10000);

      // 5. Auto-scroll sidebar to top (new items are prepended)
      setTimeout(() => {
        if (sidebarRef.current) {
          sidebarRef.current.scrollTo({ top: 0, behavior: 'smooth' });
        }
      }, 100);
    };

    socket.on('newIncident', handleNewIncident);

    // Handle status/severity updates from other admin sessions
    const handleIncidentUpdated = ({ incidentId, status, severity, assignedResponders }) => {
      setIncidents(prev =>
        prev.map(inc =>
          inc._id === incidentId
            ? { ...inc, ...(status && { status }), ...(severity && { severity }), ...(assignedResponders && { assignedResponders }) }
            : inc
        )
      );
    };
    socket.on('incidentUpdated', handleIncidentUpdated);

    // Handle emergency broadcast alerts
    const handleAlertBroadcast = (alert) => {
      setGlobalAlert(alert);
      // Auto-dismiss after 12 seconds
      setTimeout(() => setGlobalAlert(null), 12000);
    };
    socket.on('alertBroadcast', handleAlertBroadcast);

    return () => {
      socket.off('newIncident', handleNewIncident);
      socket.off('incidentUpdated', handleIncidentUpdated);
      socket.off('alertBroadcast', handleAlertBroadcast);
    };
  }, [socket]);

  // Called by IncidentManagementPanel after a successful PATCH
  const handleIncidentUpdated = useCallback((updatedIncident) => {
    setIncidents(prev =>
      prev.map(inc => inc._id === updatedIncident._id ? updatedIncident : inc)
    );
    // Keep panel open with updated data
    setSelectedPanel(updatedIncident);
  }, []);

  const activeCount   = incidents.filter(i => !['resolved', 'closed'].includes(i.status)).length;
  const criticalCount = incidents.filter(i => i.severity === 'critical').length;
  const resolvedCount = incidents.filter(i => i.status === 'resolved').length;

  return (
    <div className="flex flex-col h-screen bg-zinc-950 text-zinc-100 overflow-hidden">

      {/* ── Toast tray (top-right) ─────────────────────────────────────────── */}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-3 pointer-events-none">
        {toasts.map(({ id, incident }) => (
          <div key={id} className="pointer-events-auto">
            <IncidentToast
              incident={incident}
              onDismiss={() => dismissToast(id)}
            />
          </div>
        ))}
      </div>

      {/* ── Top Nav ────────────────────────────────────────────────────────── */}
      <header className="flex items-center justify-between px-6 py-3 bg-zinc-900 border-b border-zinc-800 shrink-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-red-600 flex items-center justify-center text-sm font-bold">R</div>
          <div>
            <h1 className="text-base font-bold leading-none">ResQAI</h1>
            <p className="text-xs text-zinc-400 leading-none mt-0.5">Emergency Operations Center</p>
          </div>
        </div>

        {/* Stat pills */}
        <div className="hidden md:flex items-center gap-4 text-sm">
          <div className="flex items-center gap-1.5 px-3 py-1 bg-zinc-800 rounded-full">
            <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            <span className="text-zinc-300">{activeCount} Active</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1 bg-red-950/60 border border-red-900/40 rounded-full">
            <span className="w-2 h-2 bg-red-500 rounded-full" />
            <span className="text-red-400">{criticalCount} Critical</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1 bg-zinc-800 rounded-full">
            <span className="text-zinc-400">✓ {resolvedCount} Resolved</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-sm text-zinc-400 hidden md:block">{user?.name || 'Admin'}</span>
          <button
            onClick={logout}
            className="text-xs px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-md border border-zinc-700 transition"
          >
            Logout
          </button>
        </div>
      </header>

      {/* ── Global Alert Banner ───────────────────────────────────────────── */}
      {globalAlert && (
        <div className={`relative flex items-start gap-3 px-6 py-3 text-sm font-medium border-b animate-pulse shrink-0 ${
          globalAlert.alertType === 'evacuation' ? 'bg-red-950/80 border-red-800 text-red-200' :
          globalAlert.alertType === 'medical'    ? 'bg-orange-950/80 border-orange-800 text-orange-200' :
          globalAlert.alertType === 'shelter'    ? 'bg-blue-950/80 border-blue-800 text-blue-200' :
          'bg-zinc-800/80 border-zinc-700 text-zinc-200'
        }`}>
          <span className="text-xl shrink-0">
            {globalAlert.alertType === 'evacuation' ? '🚨' :
             globalAlert.alertType === 'medical'    ? '🚑' :
             globalAlert.alertType === 'shelter'    ? '🏠' : '📢'}
          </span>
          <div className="flex-1">
            <span className="font-bold uppercase tracking-wide text-xs opacity-70 mr-2">
              {globalAlert.alertType} ALERT
            </span>
            {globalAlert.message}
            <span className="text-xs opacity-50 ml-2">— {globalAlert.broadcastBy}</span>
          </div>
          <button
            onClick={() => setGlobalAlert(null)}
            className="text-lg opacity-50 hover:opacity-100 transition shrink-0"
          >
            ×
          </button>
        </div>
      )}

      {/* ── Body: Map + Sidebar ────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* Map */}
        <div className="flex-1 relative">
          {loading ? (
            <div className="w-full h-full flex items-center justify-center bg-zinc-900 text-zinc-400">
              <div className="flex flex-col items-center gap-3">
                <div className="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-sm">Loading incident data…</p>
              </div>
            </div>
          ) : (
            <LiveMap incidents={incidents} latestIncidentId={latestIncidentId} />
          )}

          {/* Live badge */}
          <div className="absolute top-4 left-4 flex items-center gap-2 px-3 py-1.5 bg-zinc-900/90 backdrop-blur-sm rounded-full border border-zinc-700 text-xs font-medium z-10">
            <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            LIVE — {incidents.length} incident{incidents.length !== 1 ? 's' : ''}
          </div>

          {/* Legend */}
          <div className="absolute bottom-6 left-4 bg-zinc-900/90 backdrop-blur-sm border border-zinc-700 rounded-xl p-3 text-xs space-y-1.5 z-10">
            <p className="text-zinc-400 font-semibold uppercase tracking-wider text-[10px] mb-2">Severity</p>
            {[
              { label: 'Critical', color: 'bg-red-500' },
              { label: 'High',     color: 'bg-orange-500' },
              { label: 'Medium',   color: 'bg-yellow-500' },
              { label: 'Low',      color: 'bg-green-500' },
            ].map(({ label, color }) => (
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
            <p className="text-xs text-zinc-500 mt-0.5">Updates in real-time via Socket.IO</p>
          </div>

          <div ref={sidebarRef} className="flex-1 overflow-y-auto divide-y divide-zinc-800/60">
            {incidents.length === 0 ? (
              <div className="p-6 text-center text-zinc-500 text-sm">
                <p className="text-2xl mb-2">🛡️</p>
                <p>No incidents reported yet.</p>
              </div>
            ) : (
              incidents.map((inc) => {
                const isNew = newIds.has(inc._id);
                return (
                  <button
                    key={inc._id}
                    ref={el => incidentRefs.current[inc._id] = el}
                    onClick={() => setSelectedPanel(selectedPanel?._id === inc._id ? null : inc)}
                    className={`w-full text-left px-4 py-3 hover:bg-zinc-800/60 transition group relative ${
                      isNew ? 'bg-zinc-800/40' : ''
                    }`}
                  >
                    {/* NEW badge */}
                    {isNew && (
                      <span className="absolute top-2 right-2 text-[9px] font-bold px-1.5 py-0.5 bg-red-600 text-white rounded-full animate-pulse">
                        NEW
                      </span>
                    )}

                    <div className="flex items-start gap-2">
                      <span className="text-lg shrink-0">{TYPE_ICONS[inc.type] || '📍'}</span>
                      <div className="flex-1 min-w-0 pr-6">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-zinc-100 truncate group-hover:text-white">
                            {inc.title}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className={`shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded border ${SEVERITY_COLORS[inc.severity]}`}>
                            {inc.severity?.toUpperCase()}
                          </span>
                          <p className="text-xs text-zinc-500 truncate">{inc.description}</p>
                        </div>
                        <p className="text-[10px] text-zinc-600 mt-1 truncate">
                          {inc.location?.address ||
                            (inc.location?.coordinates
                              ? `${inc.location.coordinates[1]?.toFixed(4)}, ${inc.location.coordinates[0]?.toFixed(4)}`
                              : 'Unknown location')}
                        </p>
                      </div>
                    </div>

                    {/* Expanded AI Triage + Management panel */}
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
                            {inc.aiTriage.recommendedActions?.length > 0 && (
                              <ul className="mt-2 space-y-1">
                                {inc.aiTriage.recommendedActions.map((action, i) => (
                                  <li key={i} className="text-[11px] text-blue-200 flex gap-1.5">
                                    <span className="text-blue-500 shrink-0">→</span>
                                    {action}
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        )}

                        {/* Admin management panel */}
                        <IncidentManagementPanel
                          incident={inc}
                          token={token}
                          onIncidentUpdated={handleIncidentUpdated}
                        />
                      </div>
                    )}
                  </button>
                );
              })
            )}
          </div>

          {/* Footer CTAs */}
          <div className="px-4 py-3 border-t border-zinc-800 shrink-0 space-y-2">
            <a
              href="/report"
              className="flex items-center justify-center gap-2 w-full py-2 bg-red-600 hover:bg-red-700 rounded-lg text-sm font-semibold transition"
            >
              <span>🚨</span> Report New Incident
            </a>
            <a
              href="/shelters"
              className="flex items-center justify-center gap-2 w-full py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm font-semibold transition border border-zinc-700"
            >
              <span>🏥</span> Find Shelters & Hospitals
            </a>
            <a
              href="/chat"
              className="flex items-center justify-center gap-2 w-full py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm font-semibold transition border border-zinc-700"
            >
              <span>💬</span> Open Chat
            </a>
          </div>
        </aside>
      </div>
    </div>
  );
};

export default Dashboard;
