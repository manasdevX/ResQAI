import { useEffect, useState } from 'react';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';
import LiveMap from '../components/LiveMap';
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
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPanel, setSelectedPanel] = useState(null);

  // Fetch existing incidents on mount
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

  // Listen for real-time new incidents
  useEffect(() => {
    if (!socket) return;

    const handleNewIncident = (incident) => {
      setIncidents((prev) => [incident, ...prev]);
    };

    socket.on('newIncident', handleNewIncident);
    return () => socket.off('newIncident', handleNewIncident);
  }, [socket]);

  const activeCount   = incidents.filter(i => !['resolved', 'closed'].includes(i.status)).length;
  const criticalCount = incidents.filter(i => i.severity === 'critical').length;
  const resolvedCount = incidents.filter(i => i.status === 'resolved').length;

  return (
    <div className="flex flex-col h-screen bg-zinc-950 text-zinc-100 overflow-hidden">
      
      {/* ── Top Nav ── */}
      <header className="flex items-center justify-between px-6 py-3 bg-zinc-900 border-b border-zinc-800 shrink-0">
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
          <span className="text-sm text-zinc-400 hidden md:block">
            {user?.name || 'Admin'}
          </span>
          <button
            onClick={logout}
            className="text-xs px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-md border border-zinc-700 transition"
          >
            Logout
          </button>
        </div>
      </header>

      {/* ── Body: Map + Sidebar ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* Map (full height) */}
        <div className="flex-1 relative">
          {loading ? (
            <div className="w-full h-full flex items-center justify-center bg-zinc-900 text-zinc-400">
              <div className="flex flex-col items-center gap-3">
                <div className="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-sm">Loading incident data…</p>
              </div>
            </div>
          ) : (
            <LiveMap incidents={incidents} />
          )}

          {/* Live badge */}
          <div className="absolute top-4 left-4 flex items-center gap-2 px-3 py-1.5 bg-zinc-900/90 backdrop-blur-sm rounded-full border border-zinc-700 text-xs font-medium">
            <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            LIVE — {incidents.length} incident{incidents.length !== 1 ? 's' : ''}
          </div>

          {/* Legend */}
          <div className="absolute bottom-6 left-4 bg-zinc-900/90 backdrop-blur-sm border border-zinc-700 rounded-xl p-3 text-xs space-y-1.5">
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
          <div className="px-4 py-3 border-b border-zinc-800">
            <h2 className="text-sm font-semibold text-zinc-200">Incident Feed</h2>
            <p className="text-xs text-zinc-500 mt-0.5">Updates in real-time via Socket.IO</p>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-zinc-800/60">
            {incidents.length === 0 ? (
              <div className="p-6 text-center text-zinc-500 text-sm">
                <p className="text-2xl mb-2">🛡️</p>
                <p>No incidents reported yet.</p>
              </div>
            ) : (
              incidents.map((inc) => (
                <button
                  key={inc._id}
                  onClick={() => setSelectedPanel(selectedPanel?._id === inc._id ? null : inc)}
                  className="w-full text-left px-4 py-3 hover:bg-zinc-800/60 transition group"
                >
                  <div className="flex items-start gap-2">
                    <span className="text-lg shrink-0">{TYPE_ICONS[inc.type] || '📍'}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium text-zinc-100 truncate group-hover:text-white">
                          {inc.title}
                        </p>
                        <span className={`shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded border ${SEVERITY_COLORS[inc.severity]}`}>
                          {inc.severity?.toUpperCase()}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-500 truncate mt-0.5">{inc.description}</p>
                      <p className="text-[10px] text-zinc-600 mt-1">
                        {inc.location?.address || `${inc.location?.coordinates?.[1]?.toFixed(4)}, ${inc.location?.coordinates?.[0]?.toFixed(4)}`}
                      </p>
                    </div>
                  </div>

                  {/* Expanded AI Triage panel */}
                  {selectedPanel?._id === inc._id && inc.aiTriage && (
                    <div className="mt-3 p-3 bg-blue-950/30 border border-blue-900/40 rounded-lg text-left">
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
                </button>
              ))
            )}
          </div>

          {/* Footer quick link */}
          <div className="px-4 py-3 border-t border-zinc-800 shrink-0">
            <a
              href="/report"
              className="flex items-center justify-center gap-2 w-full py-2 bg-red-600 hover:bg-red-700 rounded-lg text-sm font-semibold transition"
            >
              <span>🚨</span> Report New Incident
            </a>
          </div>
        </aside>
      </div>
    </div>
  );
};

export default Dashboard;
