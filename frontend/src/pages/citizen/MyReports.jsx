import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { RefreshCw, MapPin, Clock, AlertTriangle, FileText } from 'lucide-react';

import { SEVERITY_BADGE, TYPE_ICONS, INCIDENT_STATUS } from '../../constants/incident';

const STATUS_STEPS = ['reported', 'acknowledged', 'responding', 'resolved'];

const MyReports = () => {
  const { api } = useAuth();
  const [incidents, setIncidents] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);
  const [expanded,  setExpanded]  = useState(null);

  const fetchReports = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get('/incidents?limit=200');
      setIncidents(data.incidents || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load reports');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchReports(); }, []);

  const stepIndex = (status) => STATUS_STEPS.indexOf(status);

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black text-zinc-100">My Reports</h1>
          <p className="text-sm text-zinc-500 mt-0.5">{incidents.length} incident{incidents.length !== 1 ? 's' : ''} reported</p>
        </div>
        <button
          onClick={fetchReports}
          disabled={loading}
          className="p-2.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-xl transition"
        >
          <RefreshCw className={`w-4 h-4 text-zinc-400 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-4 bg-red-950/40 border border-red-800/40 rounded-xl text-red-400 text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="p-4 bg-zinc-900 border border-zinc-800 rounded-2xl animate-pulse space-y-3">
              <div className="h-4 bg-zinc-800 rounded w-3/4" />
              <div className="h-3 bg-zinc-800 rounded w-1/2" />
              <div className="h-2 bg-zinc-800 rounded-full" />
            </div>
          ))}
        </div>
      ) : incidents.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-zinc-500">
          <FileText className="w-12 h-12 mb-3 opacity-30" />
          <p className="text-base font-semibold text-zinc-400">No reports yet</p>
          <p className="text-sm mt-1 text-center">When you report an emergency, it will appear here with live status updates.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {incidents.map(inc => {
            const statusStyle = INCIDENT_STATUS[inc.status] || INCIDENT_STATUS.reported;
            const currentStep = stepIndex(inc.status);
            const isResolved  = inc.status === 'resolved' || inc.status === 'closed';
            const isExpanded  = expanded === inc._id;

            return (
              <div key={inc._id} className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden hover:border-zinc-700 transition-all">
                <button
                  onClick={() => setExpanded(isExpanded ? null : inc._id)}
                  className="w-full text-left p-4"
                >
                  <div className="flex items-start gap-3">
                    <span className="text-2xl shrink-0 mt-0.5">{TYPE_ICONS[inc.type] || '📍'}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-bold text-zinc-100 leading-tight truncate">{inc.title}</p>
                        <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full ${statusStyle.color}`}>
                          {statusStyle.label}
                        </span>
                      </div>

                      <p className="text-xs text-zinc-500 mt-1 flex items-center gap-1">
                        <MapPin className="w-2.5 h-2.5 shrink-0" />
                        {inc.location?.address || `${inc.location?.coordinates?.[1]?.toFixed(4)}, ${inc.location?.coordinates?.[0]?.toFixed(4)}`}
                      </p>
                      <p className="text-xs text-zinc-600 mt-0.5 flex items-center gap-1">
                        <Clock className="w-2.5 h-2.5 shrink-0" />
                        {new Date(inc.createdAt).toLocaleString()}
                      </p>

                      {/* Progress bar */}
                      {!isResolved ? (
                        <div className="flex items-center gap-1 mt-2.5">
                          {STATUS_STEPS.map((step, i) => (
                            <div key={step} className="flex items-center gap-1 flex-1">
                              <div className={`h-1.5 flex-1 rounded-full transition-all ${
                                i <= currentStep ? 'bg-blue-500' : 'bg-zinc-700'
                              }`} />
                              {i < STATUS_STEPS.length - 1 && null}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="h-1.5 w-full bg-green-500/60 rounded-full mt-2.5" />
                      )}
                    </div>

                    <span className={`shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded border ${SEVERITY_BADGE[inc.severity]}`}>
                      {inc.severity?.toUpperCase()}
                    </span>
                  </div>
                </button>

                {isExpanded && (
                  <div className="px-4 pb-4 space-y-3 border-t border-zinc-800 pt-3">
                    <p className="text-sm text-zinc-400 leading-relaxed">{inc.description}</p>

                    {inc.aiTriage && (
                      <div className="p-3 bg-blue-950/30 border border-blue-900/30 rounded-xl">
                        <p className="text-[10px] font-bold text-blue-400 uppercase tracking-wider mb-1.5">AI Triage</p>
                        <p className="text-xs text-blue-200/80 leading-relaxed">{inc.aiTriage.summary}</p>
                        <div className="flex gap-3 mt-2 text-[10px] text-blue-300">
                          <span>Risk: <strong>{inc.aiTriage.riskScore}/100</strong></span>
                          <span>Affected: <strong>~{inc.aiTriage.estimatedAffected}</strong></span>
                        </div>
                      </div>
                    )}

                    {inc.statusHistory?.length > 0 && (
                      <div>
                        <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-2">Status History</p>
                        <div className="space-y-1.5">
                          {[...inc.statusHistory].reverse().map((h, i) => (
                            <div key={i} className="flex items-start gap-2 text-xs">
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                              <div>
                                <span className="font-semibold text-zinc-300 capitalize">{h.status}</span>
                                {h.note && <span className="text-zinc-500 ml-1.5">— {h.note}</span>}
                                <p className="text-zinc-600 mt-0.5">{new Date(h.updatedAt).toLocaleString()}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default MyReports;
