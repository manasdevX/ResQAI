import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { RefreshCw, MapPin, Clock, AlertTriangle, CheckCircle, ClipboardList } from 'lucide-react';

import { SEVERITY_BADGE, TYPE_ICONS, INCIDENT_STATUS } from '../../constants/incident';

const VolunteerAssignments = () => {
  const { user, api } = useAuth();
  const [incidents, setIncidents] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);
  const [updatingId, setUpdatingId] = useState(null);

  const fetchAssignments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get('/incidents?limit=200');
      const mine = (data.incidents || []).filter(inc =>
        inc.assignedResponders?.some(r => r === user?._id || r?._id === user?._id)
      );
      setIncidents(mine);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load assignments');
    } finally {
      setLoading(false);
    }
  }, [api, user]);

  useEffect(() => { fetchAssignments(); }, [fetchAssignments]);

  const handleStatusUpdate = async (incidentId, newStatus) => {
    setUpdatingId(incidentId);
    try {
      const { data } = await api.patch(`/incidents/${incidentId}/status`, { status: newStatus });
      setIncidents(prev => prev.map(inc => inc._id === incidentId ? data.incident : inc));
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update status');
    } finally {
      setUpdatingId(null);
    }
  };

  const activeCount   = incidents.filter(i => !['resolved', 'closed'].includes(i.status)).length;
  const resolvedCount = incidents.filter(i => i.status === 'resolved').length;

  return (
    <div className="flex-1 overflow-y-auto p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-black text-zinc-100">My Assignments</h1>
          <p className="text-xs text-zinc-500 mt-0.5">{activeCount} active · {resolvedCount} resolved</p>
        </div>
        <button
          onClick={fetchAssignments}
          disabled={loading}
          className="p-2.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-xl transition"
        >
          <RefreshCw className={`w-4 h-4 text-zinc-400 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3.5 bg-red-950/40 border border-red-800/40 rounded-xl text-red-400 text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2].map(i => (
            <div key={i} className="p-4 bg-zinc-900 border border-zinc-800 rounded-2xl animate-pulse space-y-3">
              <div className="h-4 bg-zinc-800 rounded w-3/4" />
              <div className="h-3 bg-zinc-800 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : incidents.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-zinc-500">
          <ClipboardList className="w-10 h-10 mb-3 opacity-30" />
          <p className="text-base font-semibold text-zinc-400">No assignments yet</p>
          <p className="text-sm mt-1 text-center">Accept incidents from Nearby Incidents to see them here.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {incidents.map(inc => {
            const statusStyle = INCIDENT_STATUS[inc.status] || INCIDENT_STATUS.reported;
            const isActive    = !['resolved', 'closed'].includes(inc.status);

            return (
              <div key={inc._id} className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden hover:border-zinc-700 transition-all">
                <div className={`h-0.5 w-full ${
                  inc.severity === 'critical' ? 'bg-red-500' : inc.severity === 'high' ? 'bg-orange-500'
                  : inc.severity === 'medium' ? 'bg-yellow-500' : 'bg-green-500'
                }`} />

                <div className="p-4 space-y-3">
                  {inc.isSOS && (
                    <div className="text-xs font-bold text-red-400 bg-red-950/40 border border-red-700/30 px-2.5 py-1 rounded-lg">
                      🚨 SOS Emergency
                    </div>
                  )}

                  <div className="flex items-start gap-2.5">
                    <span className="text-xl shrink-0">{TYPE_ICONS[inc.type] || '📍'}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-bold text-zinc-100 leading-tight">{inc.title}</p>
                        <span className={`shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded border ${SEVERITY_BADGE[inc.severity]}`}>
                          {inc.severity?.toUpperCase()}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-500 mt-1 flex items-center gap-1">
                        <MapPin className="w-2.5 h-2.5 shrink-0" />
                        {inc.location?.address || 'Location unknown'}
                      </p>
                      <p className="text-xs text-zinc-600 mt-0.5 flex items-center gap-1">
                        <Clock className="w-2.5 h-2.5 shrink-0" />
                        {new Date(inc.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </div>

                  <p className="text-sm text-zinc-400 line-clamp-2">{inc.description}</p>

                  <div className="flex items-center justify-between">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${statusStyle.color}`}>
                      {statusStyle.label}
                    </span>

                    {isActive && (
                      <div className="flex gap-2">
                        {inc.status !== 'responding' && (
                          <button
                            onClick={() => handleStatusUpdate(inc._id, 'responding')}
                            disabled={updatingId === inc._id}
                            className="text-xs px-3 py-1.5 bg-yellow-600/20 hover:bg-yellow-600/30 border border-yellow-600/30 text-yellow-400 rounded-lg font-semibold transition disabled:opacity-50"
                          >
                            Mark Responding
                          </button>
                        )}
                        <button
                          onClick={() => handleStatusUpdate(inc._id, 'resolved')}
                          disabled={updatingId === inc._id}
                          className="flex items-center gap-1 text-xs px-3 py-1.5 bg-green-600/20 hover:bg-green-600/30 border border-green-600/30 text-green-400 rounded-lg font-semibold transition disabled:opacity-50"
                        >
                          {updatingId === inc._id ? <RefreshCw className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />}
                          Resolve
                        </button>
                      </div>
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

export default VolunteerAssignments;
