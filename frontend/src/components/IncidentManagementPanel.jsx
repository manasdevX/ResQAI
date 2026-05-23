import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { UserPlus, X, Loader2 } from 'lucide-react';

const STATUS_OPTIONS = [
  { value: 'reported',     label: 'Reported',     color: 'text-zinc-400' },
  { value: 'acknowledged', label: 'Acknowledged', color: 'text-blue-400' },
  { value: 'responding',   label: 'Responding',   color: 'text-yellow-400' },
  { value: 'resolved',     label: 'Resolved',     color: 'text-green-400' },
  { value: 'closed',       label: 'Closed',       color: 'text-zinc-600' },
];

const SEVERITY_OPTIONS = [
  { value: 'low',      label: 'Low',      bg: 'bg-green-500/20 text-green-400 border-green-500/40' },
  { value: 'medium',   label: 'Medium',   bg: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40' },
  { value: 'high',     label: 'High',     bg: 'bg-orange-500/20 text-orange-400 border-orange-500/40' },
  { value: 'critical', label: 'Critical', bg: 'bg-red-500/20 text-red-400 border-red-500/40' },
];

const ALERT_TYPES = [
  { value: 'general',    label: '📢 General',   desc: 'General public information' },
  { value: 'evacuation', label: '🚨 Evacuation', desc: 'Immediate area evacuation' },
  { value: 'shelter',    label: '🏠 Shelter',    desc: 'Move to nearest shelter' },
  { value: 'medical',    label: '🚑 Medical',    desc: 'Medical emergency response' },
];

const STATUS_DOT = {
  reported:     'bg-zinc-500',
  acknowledged: 'bg-blue-500',
  responding:   'bg-yellow-500',
  resolved:     'bg-green-500',
  closed:       'bg-zinc-600',
};

const STATUS_LABEL_COLOR = {
  reported:     'text-zinc-400',
  acknowledged: 'text-blue-400',
  responding:   'text-yellow-400',
  resolved:     'text-green-400',
  closed:       'text-zinc-600',
};

const IncidentManagementPanel = ({ incident, onIncidentUpdated }) => {
  const { api } = useAuth();
  const [activeTab,         setActiveTab]         = useState('status');
  const [selectedStatus,    setSelectedStatus]    = useState(incident.status);
  const [statusNote,        setStatusNote]        = useState('');
  const [selectedSeverity,  setSelectedSeverity]  = useState(incident.severity);
  const [alertMessage,      setAlertMessage]      = useState('');
  const [alertType,         setAlertType]         = useState('general');
  const [loading,           setLoading]           = useState(false);
  const [feedback,          setFeedback]          = useState(null);

  // Assign tab
  const [assignedResponders, setAssignedResponders] = useState(incident.assignedResponders || []);
  const [availableResponders, setAvailableResponders] = useState([]);
  const [respLoading,         setRespLoading]         = useState(false);
  const [selectedResponder,   setSelectedResponder]   = useState('');
  const [assignLoading,       setAssignLoading]       = useState(false);

  const showFeedback = (type, text) => {
    setFeedback({ type, text });
    setTimeout(() => setFeedback(null), 3000);
  };

  const handleStatusUpdate = async () => {
    if (selectedStatus === incident.status && !statusNote) return;
    setLoading(true);
    try {
      const { data } = await api.patch(`/incidents/${incident._id}/status`, { status: selectedStatus, note: statusNote });
      onIncidentUpdated(data.incident);
      showFeedback('success', `Status updated to "${selectedStatus}"`);
      setStatusNote('');
    } catch {
      showFeedback('error', 'Failed to update status');
    } finally {
      setLoading(false);
    }
  };

  const handleSeverityUpdate = async () => {
    if (selectedSeverity === incident.severity) return;
    setLoading(true);
    try {
      const { data } = await api.patch(`/incidents/${incident._id}/severity`, { severity: selectedSeverity });
      onIncidentUpdated(data.incident);
      showFeedback('success', `Priority set to "${selectedSeverity}"`);
    } catch {
      showFeedback('error', 'Failed to update priority');
    } finally {
      setLoading(false);
    }
  };

  const handleBroadcast = async () => {
    if (!alertMessage.trim()) return;
    setLoading(true);
    try {
      await api.post('/incidents/broadcast-alert', { incidentId: incident._id, message: alertMessage, alertType });
      showFeedback('success', 'Alert broadcast sent to all users!');
      setAlertMessage('');
    } catch {
      showFeedback('error', 'Failed to send alert');
    } finally {
      setLoading(false);
    }
  };

  // Fetch available responders when assign tab is opened
  useEffect(() => {
    if (activeTab !== 'assign') return;
    setRespLoading(true);
    api.get('/users/responders')
      .then(({ data }) => setAvailableResponders(data.responders || []))
      .catch(() => {})
      .finally(() => setRespLoading(false));
  }, [activeTab, api]);

  const handleAssign = async () => {
    if (!selectedResponder) return;
    setAssignLoading(true);
    try {
      const { data } = await api.post(`/incidents/${incident._id}/assign`, { responderId: selectedResponder });
      const updated = data.incident;
      setAssignedResponders(updated.assignedResponders || []);
      onIncidentUpdated(updated);
      showFeedback('success', 'Responder assigned');
      setSelectedResponder('');
    } catch (err) {
      showFeedback('error', err.response?.data?.message || 'Failed to assign responder');
    } finally {
      setAssignLoading(false);
    }
  };

  const handleUnassign = async (responderId) => {
    setAssignLoading(true);
    try {
      const { data } = await api.delete(`/incidents/${incident._id}/assign/${responderId}`);
      const updated = data.incident;
      setAssignedResponders(updated.assignedResponders || []);
      onIncidentUpdated(updated);
      showFeedback('success', 'Responder removed');
    } catch (err) {
      showFeedback('error', err.response?.data?.message || 'Failed to remove responder');
    } finally {
      setAssignLoading(false);
    }
  };

  const history = incident.statusHistory ? [...incident.statusHistory].reverse() : [];

  return (
    <div className="mt-3 rounded-xl border border-zinc-700/60 bg-zinc-900/80 overflow-hidden text-sm">

      {/* Tab bar */}
      <div className="flex border-b border-zinc-700/60">
        {[
          { key: 'status',   label: '🔄 Status' },
          { key: 'priority', label: '⚡ Priority' },
          { key: 'alert',    label: '📡 Broadcast' },
          { key: 'assign',   label: '👤 Assign' },
          { key: 'timeline', label: '📋 Timeline' },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 py-2 text-xs font-semibold transition ${
              activeTab === tab.key
                ? 'text-white bg-zinc-800 border-b-2 border-blue-500'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="p-3 space-y-3">

        {/* ── Status Tab ── */}
        {activeTab === 'status' && (
          <>
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
              {STATUS_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setSelectedStatus(opt.value)}
                  className={`py-1.5 px-2 rounded-lg text-xs font-medium border transition ${
                    selectedStatus === opt.value
                      ? 'bg-blue-600 text-white border-blue-500'
                      : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:border-zinc-500'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <textarea
              rows={2}
              value={statusNote}
              onChange={e => setStatusNote(e.target.value)}
              placeholder="Optional note (e.g. 2 units dispatched)…"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-zinc-200 placeholder-zinc-600 resize-none focus:outline-none focus:border-blue-500"
            />
            <button
              onClick={handleStatusUpdate}
              disabled={loading || (selectedStatus === incident.status && !statusNote)}
              className="w-full py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {loading ? 'Saving…' : 'Update Status'}
            </button>
          </>
        )}

        {/* ── Priority Tab ── */}
        {activeTab === 'priority' && (
          <>
            <div className="grid grid-cols-2 gap-1.5">
              {SEVERITY_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setSelectedSeverity(opt.value)}
                  className={`py-2 rounded-lg text-xs font-bold border transition ${
                    selectedSeverity === opt.value
                      ? opt.bg + ' ring-1 ring-offset-1 ring-offset-zinc-900 ring-current'
                      : 'bg-zinc-800 text-zinc-500 border-zinc-700 hover:border-zinc-500'
                  }`}
                >
                  {opt.label.toUpperCase()}
                </button>
              ))}
            </div>
            <button
              onClick={handleSeverityUpdate}
              disabled={loading || selectedSeverity === incident.severity}
              className="w-full py-2 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {loading ? 'Saving…' : 'Set Priority'}
            </button>
          </>
        )}

        {/* ── Broadcast Tab ── */}
        {activeTab === 'alert' && (
          <>
            <div className="grid grid-cols-2 gap-1.5">
              {ALERT_TYPES.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setAlertType(opt.value)}
                  className={`py-1.5 px-2 rounded-lg text-xs font-medium border transition text-left ${
                    alertType === opt.value
                      ? 'bg-red-900/40 text-red-300 border-red-700'
                      : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:border-zinc-500'
                  }`}
                >
                  <span className="block">{opt.label}</span>
                  <span className="text-[10px] text-zinc-500">{opt.desc}</span>
                </button>
              ))}
            </div>
            <textarea
              rows={3}
              value={alertMessage}
              onChange={e => setAlertMessage(e.target.value)}
              placeholder="Write your emergency broadcast message…"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-zinc-200 placeholder-zinc-600 resize-none focus:outline-none focus:border-red-500"
            />
            <button
              onClick={handleBroadcast}
              disabled={loading || !alertMessage.trim()}
              className="w-full py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {loading ? 'Broadcasting…' : '📡 Send Alert to All Users'}
            </button>
          </>
        )}

        {/* ── Assign Tab ── */}
        {activeTab === 'assign' && (
          <div className="space-y-3">
            {/* Currently assigned */}
            {assignedResponders.length > 0 ? (
              <div className="space-y-1.5">
                <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Assigned</p>
                {assignedResponders.map(r => {
                  const id       = r._id || r;
                  const name     = r.name || 'Responder';
                  const initials = name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
                  return (
                    <div key={id} className="flex items-center gap-2 px-2.5 py-1.5 bg-blue-900/20 border border-blue-800/30 rounded-lg">
                      <div className="w-6 h-6 rounded-full bg-blue-600/70 flex items-center justify-center text-[10px] font-bold text-white shrink-0">
                        {r.avatar ? <img src={r.avatar} alt={name} className="w-full h-full object-cover rounded-full" /> : initials}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-zinc-200 truncate">{name}</p>
                        {r.role && <p className="text-[10px] text-zinc-500 capitalize">{r.role.replace('_', ' ')}</p>}
                      </div>
                      <button
                        onClick={() => handleUnassign(id)}
                        disabled={assignLoading}
                        className="p-1 text-zinc-500 hover:text-red-400 hover:bg-red-950/30 rounded transition disabled:opacity-40"
                        title="Remove"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-zinc-600 text-center py-2">No responders assigned yet</p>
            )}

            {/* Assign new */}
            <div className="space-y-2">
              <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Add Responder</p>
              {respLoading ? (
                <div className="flex items-center justify-center py-3">
                  <Loader2 className="w-4 h-4 animate-spin text-zinc-500" />
                </div>
              ) : (
                <select
                  value={selectedResponder}
                  onChange={e => setSelectedResponder(e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-blue-500"
                >
                  <option value="">Select available responder…</option>
                  {availableResponders
                    .filter(r => !assignedResponders.some(a => (a._id?.toString() || a?.toString()) === r._id?.toString()))
                    .map(r => (
                      <option key={r._id} value={r._id}>{r.name} ({r.role?.replace('_', ' ')})</option>
                    ))
                  }
                </select>
              )}
              <button
                onClick={handleAssign}
                disabled={assignLoading || !selectedResponder}
                className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                {assignLoading
                  ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Assigning…</>
                  : <><UserPlus className="w-3.5 h-3.5" /> Assign Responder</>
                }
              </button>
            </div>
          </div>
        )}

        {/* ── Timeline Tab ── */}
        {activeTab === 'timeline' && (
          <div>
            {history.length === 0 ? (
              <p className="text-xs text-zinc-600 text-center py-4">No status history yet.</p>
            ) : (
              <div className="relative pl-5">
                {/* Vertical connector line */}
                <div className="absolute left-[7px] top-2 bottom-2 w-px bg-zinc-700" />

                <div className="space-y-4">
                  {history.map((h, i) => (
                    <div key={i} className="relative flex items-start gap-3">
                      {/* Dot */}
                      <div className={`absolute -left-5 mt-0.5 w-3.5 h-3.5 rounded-full border-2 border-zinc-900 shrink-0 ${STATUS_DOT[h.status] || 'bg-zinc-600'}`} />

                      <div className="flex-1 min-w-0 pb-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-xs font-bold capitalize ${STATUS_LABEL_COLOR[h.status] || 'text-zinc-400'}`}>
                            {h.status}
                          </span>
                          {i === 0 && (
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 bg-blue-600/20 text-blue-400 border border-blue-600/30 rounded-full">
                              Current
                            </span>
                          )}
                        </div>
                        {h.note && (
                          <p className="text-[11px] text-zinc-400 mt-0.5 leading-relaxed">{h.note}</p>
                        )}
                        <p className="text-[10px] text-zinc-600 mt-0.5">
                          {h.updatedAt
                            ? new Date(h.updatedAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                            : '—'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Feedback message */}
        {feedback && (
          <div className={`text-xs px-3 py-2 rounded-lg font-medium ${
            feedback.type === 'success'
              ? 'bg-green-900/40 text-green-400 border border-green-800/60'
              : 'bg-red-900/40 text-red-400 border border-red-800/60'
          }`}>
            {feedback.type === 'success' ? '✓ ' : '✗ '}{feedback.text}
          </div>
        )}
      </div>
    </div>
  );
};

export default IncidentManagementPanel;
