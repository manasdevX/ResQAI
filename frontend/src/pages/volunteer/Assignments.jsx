import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import {
  RefreshCw, MapPin, Clock, AlertTriangle, CheckCircle,
  ClipboardList, ChevronDown, ChevronUp, MessageSquare,
  X, Users, Activity, Zap, History,
} from 'lucide-react';
import { SEVERITY_BADGE, TYPE_ICONS, INCIDENT_STATUS } from '../../constants/incident';

/* ─── Resolve confirmation modal ────────────────────────────────────────────── */
const ResolveModal = ({ incident, onConfirm, onCancel, loading }) => {
  const [note, setNote] = useState('');
  const valid = note.trim().length >= 10;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md bg-zinc-900 border border-zinc-700 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
          <div className="flex items-center gap-2.5">
            <CheckCircle className="w-5 h-5 text-green-400" />
            <p className="text-sm font-bold text-zinc-100">Resolve Incident</p>
          </div>
          <button onClick={onCancel} className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Incident name */}
          <div className="p-3 bg-zinc-800/60 border border-zinc-700/50 rounded-xl">
            <p className="text-[10px] font-bold text-zinc-500 uppercase mb-1">Incident</p>
            <p className="text-sm font-semibold text-zinc-200">{incident.title}</p>
          </div>

          {/* Resolution note */}
          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-2">
              Resolution note <span className="text-red-400">*</span>
              <span className="text-zinc-600 font-normal ml-1">(min 10 characters)</span>
            </label>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Describe what was done to resolve this incident…"
              rows={3}
              className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-xl text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-green-500/60 resize-none transition"
            />
            <p className={`text-[10px] mt-1 text-right ${note.length >= 10 ? 'text-green-400' : 'text-zinc-600'}`}>
              {note.length} / 10 minimum
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-2.5 pt-1">
            <button
              onClick={onCancel}
              className="flex-1 py-2.5 text-sm font-semibold text-zinc-400 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-xl transition"
            >
              Cancel
            </button>
            <button
              onClick={() => onConfirm(note)}
              disabled={!valid || loading}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold text-white bg-green-600 hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition"
            >
              {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
              Confirm Resolve
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ─── Status history timeline ────────────────────────────────────────────────── */
const STATUS_DOT = {
  reported:     'bg-zinc-500',
  acknowledged: 'bg-blue-500',
  responding:   'bg-yellow-500',
  resolved:     'bg-green-500',
  closed:       'bg-zinc-400',
};

const StatusTimeline = ({ history }) => {
  if (!history?.length) return null;
  return (
    <div className="space-y-2">
      {[...history].reverse().map((entry, idx) => (
        <div key={idx} className="flex items-start gap-3">
          <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${STATUS_DOT[entry.status] || 'bg-zinc-600'}`} />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-zinc-300 capitalize">{entry.status}</p>
            {entry.note && <p className="text-[11px] text-zinc-500 mt-0.5 break-words">{entry.note}</p>}
            <p className="text-[10px] text-zinc-600 mt-0.5">
              {entry.updatedBy?.name ? `by ${entry.updatedBy.name} · ` : ''}
              {new Date(entry.updatedAt || entry.createdAt).toLocaleString()}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
};

/* ─── Note / Add Update form ─────────────────────────────────────────────────── */
const AddNoteForm = ({ incidentId, onNoteAdded, api }) => {
  const [note, setNote]     = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr]       = useState(null);

  const submit = async () => {
    const trimmed = note.trim();
    if (!trimmed) return;
    setSaving(true);
    setErr(null);
    try {
      const { data } = await api.patch(`/incidents/${incidentId}/status`, {
        status: 'responding',
        note:   trimmed,
      });
      onNoteAdded(data.incident);
      setNote('');
    } catch (e) {
      setErr(e.response?.data?.message || 'Failed to add note');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-2">
      <textarea
        value={note}
        onChange={e => setNote(e.target.value)}
        placeholder="Add a progress update…"
        rows={2}
        className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-xl text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-blue-500/60 resize-none transition"
      />
      {err && <p className="text-[11px] text-red-400">{err}</p>}
      <button
        onClick={submit}
        disabled={saving || !note.trim()}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600/30 hover:bg-blue-600/50 disabled:opacity-50 border border-blue-600/40 text-blue-300 text-xs font-semibold rounded-lg transition"
      >
        {saving ? <RefreshCw className="w-3 h-3 animate-spin" /> : <MessageSquare className="w-3 h-3" />}
        Post Update
      </button>
    </div>
  );
};

/* ─── Main component ─────────────────────────────────────────────────────────── */
const VolunteerAssignments = () => {
  const { user, api } = useAuth();
  const socket        = useSocket();

  const [incidents,    setIncidents]    = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState(null);
  const [updatingId,   setUpdatingId]   = useState(null);
  const [expandedId,   setExpandedId]   = useState(null);
  const [showNoteId,   setShowNoteId]   = useState(null);
  const [resolveTarget, setResolveTarget] = useState(null); // incident to confirm resolve
  const [resolving,    setResolving]    = useState(false);
  const [justResolved, setJustResolved] = useState(null);  // id of freshly resolved incident

  /* fetch */
  const fetchAssignments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get('/incidents?limit=200');
      const mine = (data.incidents || []).filter(inc =>
        inc.assignedResponders?.some(r => (r?._id?.toString() || r?.toString()) === user?._id?.toString())
      );
      setIncidents(mine);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load assignments');
    } finally {
      setLoading(false);
    }
  }, [api, user]);

  useEffect(() => { fetchAssignments(); }, [fetchAssignments]);

  /* real-time updates */
  useEffect(() => {
    if (!socket) return;
    const onUpdated = ({ incidentId, status, assignedResponders, statusHistory }) => {
      setIncidents(prev => prev.map(inc =>
        inc._id === incidentId
          ? { ...inc, ...(status && { status }), ...(assignedResponders && { assignedResponders }), ...(statusHistory && { statusHistory }) }
          : inc
      ));
    };
    socket.on('incidentUpdated', onUpdated);
    return () => socket.off('incidentUpdated', onUpdated);
  }, [socket]);

  /* mark responding */
  const handleMarkResponding = async (incidentId) => {
    setUpdatingId(incidentId);
    try {
      const { data } = await api.patch(`/incidents/${incidentId}/status`, { status: 'responding' });
      setIncidents(prev => prev.map(inc => inc._id === incidentId ? data.incident : inc));
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update status');
    } finally {
      setUpdatingId(null);
    }
  };

  /* resolve with note */
  const handleResolve = async (note) => {
    if (!resolveTarget) return;
    setResolving(true);
    try {
      const { data } = await api.patch(`/incidents/${resolveTarget._id}/status`, {
        status: 'resolved',
        note,
      });
      const resolved = data.incident;
      setIncidents(prev => prev.map(inc => inc._id === resolveTarget._id ? resolved : inc));
      setJustResolved(resolveTarget._id);
      setTimeout(() => setJustResolved(null), 4000);
      setResolveTarget(null);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to resolve incident');
    } finally {
      setResolving(false);
    }
  };

  const activeCount   = incidents.filter(i => !['resolved', 'closed'].includes(i.status)).length;
  const resolvedCount = incidents.filter(i => i.status === 'resolved').length;

  return (
    <>
      {/* Resolve modal */}
      {resolveTarget && (
        <ResolveModal
          incident={resolveTarget}
          loading={resolving}
          onConfirm={handleResolve}
          onCancel={() => setResolveTarget(null)}
        />
      )}

      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {/* Page header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-black text-zinc-100">My Assignments</h1>
            <p className="text-xs text-zinc-500 mt-0.5">
              {activeCount} active · {resolvedCount} resolved
            </p>
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
            <button onClick={() => setError(null)} className="ml-auto text-xs underline">Dismiss</button>
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
          <div className="flex flex-col items-center justify-center py-20 text-zinc-500">
            <ClipboardList className="w-12 h-12 mb-4 opacity-20" />
            <p className="text-base font-semibold text-zinc-400">No assignments yet</p>
            <p className="text-sm mt-1 text-center max-w-xs">
              Accept incidents from Nearby Incidents to see them here.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {incidents.map(inc => {
              const statusStyle  = INCIDENT_STATUS[inc.status] || INCIDENT_STATUS.reported;
              const isActive     = !['resolved', 'closed'].includes(inc.status);
              const isExpanded   = expandedId === inc._id;
              const isJustDone   = justResolved === inc._id;
              const responderCnt = inc.assignedResponders?.length || 1;

              return (
                <div
                  key={inc._id}
                  className={`bg-zinc-900 border rounded-2xl overflow-hidden transition-all duration-300 ${
                    isJustDone  ? 'border-green-600/50 shadow-lg shadow-green-600/10' :
                    isExpanded  ? 'border-blue-600/30'                                :
                    inc.isSOS   ? 'border-red-600/40'                                 :
                    'border-zinc-800 hover:border-zinc-700'
                  }`}
                >
                  {/* Severity bar */}
                  <div className={`h-0.5 w-full ${
                    inc.severity === 'critical' ? 'bg-red-500' :
                    inc.severity === 'high'     ? 'bg-orange-500' :
                    inc.severity === 'medium'   ? 'bg-yellow-500' : 'bg-green-500'
                  }`} />

                  <div className="p-4 space-y-3">
                    {/* SOS badge */}
                    {inc.isSOS && (
                      <div className="text-xs font-bold text-red-400 bg-red-950/40 border border-red-700/30 px-2.5 py-1 rounded-lg">
                        🚨 SOS Emergency
                      </div>
                    )}

                    {/* Just resolved celebration */}
                    {isJustDone && (
                      <div className="flex items-center gap-2 text-xs font-bold text-green-400 bg-green-950/40 border border-green-700/30 px-2.5 py-1.5 rounded-lg">
                        <CheckCircle className="w-3.5 h-3.5" />
                        Incident resolved — great work! 🎉
                      </div>
                    )}

                    {/* Main content row */}
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

                    {/* Footer row */}
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        {/* Status badge */}
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${statusStyle.color}`}>
                          {statusStyle.label}
                        </span>

                        {/* Responder count */}
                        {responderCnt > 1 && (
                          <span className="flex items-center gap-1 text-[10px] text-zinc-500">
                            <Users className="w-3 h-3" /> {responderCnt} responders
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5">
                        {/* Expand / collapse */}
                        <button
                          onClick={() => setExpandedId(isExpanded ? null : inc._id)}
                          className="p-1.5 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 rounded-lg transition"
                          title={isExpanded ? 'Collapse' : 'Show timeline & actions'}
                        >
                          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </button>

                        {/* Action buttons */}
                        {isActive && (
                          <>
                            {inc.status !== 'responding' && (
                              <button
                                onClick={() => handleMarkResponding(inc._id)}
                                disabled={updatingId === inc._id}
                                className="text-xs px-3 py-1.5 bg-yellow-600/20 hover:bg-yellow-600/30 border border-yellow-600/30 text-yellow-400 rounded-lg font-semibold transition disabled:opacity-50"
                              >
                                {updatingId === inc._id ? <RefreshCw className="w-3 h-3 animate-spin" /> : 'Mark Responding'}
                              </button>
                            )}
                            <button
                              onClick={() => setResolveTarget(inc)}
                              disabled={updatingId === inc._id}
                              className="flex items-center gap-1 text-xs px-3 py-1.5 bg-green-600/20 hover:bg-green-600/30 border border-green-600/30 text-green-400 rounded-lg font-semibold transition disabled:opacity-50"
                            >
                              <CheckCircle className="w-3 h-3" /> Resolve
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Expanded panel */}
                    {isExpanded && (
                      <div className="pt-3 border-t border-zinc-800 space-y-4">

                        {/* AI triage summary */}
                        {inc.aiTriage?.summary && (
                          <div className="p-3 bg-blue-950/30 border border-blue-900/40 rounded-xl">
                            <p className="text-[10px] font-bold text-blue-400 mb-1.5 flex items-center gap-1">
                              <Zap className="w-3 h-3" /> AI TRIAGE SUMMARY
                            </p>
                            <p className="text-xs text-blue-200/80">{inc.aiTriage.summary}</p>
                            {inc.aiTriage.recommendedActions?.[0] && (
                              <p className="text-[11px] text-blue-300/70 mt-1.5 font-medium">
                                ▸ {inc.aiTriage.recommendedActions[0]}
                              </p>
                            )}
                          </div>
                        )}

                        {/* Status history */}
                        {inc.statusHistory?.length > 0 && (
                          <div className="space-y-2">
                            <p className="text-[10px] font-bold text-zinc-500 flex items-center gap-1 uppercase">
                              <History className="w-3 h-3" /> Status History
                            </p>
                            <StatusTimeline history={inc.statusHistory} />
                          </div>
                        )}

                        {/* Add note / progress update */}
                        {isActive && (
                          <div className="space-y-2">
                            <button
                              onClick={() => setShowNoteId(showNoteId === inc._id ? null : inc._id)}
                              className="flex items-center gap-1.5 text-[11px] text-zinc-400 hover:text-zinc-200 transition"
                            >
                              <MessageSquare className="w-3 h-3" />
                              {showNoteId === inc._id ? 'Cancel update' : 'Add progress note'}
                            </button>
                            {showNoteId === inc._id && (
                              <AddNoteForm
                                incidentId={inc._id}
                                api={api}
                                onNoteAdded={(updated) => {
                                  setIncidents(prev => prev.map(i => i._id === updated._id ? updated : i));
                                  setShowNoteId(null);
                                }}
                              />
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
};

export default VolunteerAssignments;
