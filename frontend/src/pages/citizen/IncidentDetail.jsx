import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import {
  ArrowLeft, MapPin, Clock, AlertTriangle, RefreshCw,
  CheckCircle2, Users, Zap, FileText, Image, Video,
  Film, ChevronDown, ChevronUp, ExternalLink, Shield,
  Activity, Navigation,
} from 'lucide-react';
import {
  TYPE_ICONS, SEVERITY_BADGE, SEVERITY_DOT, INCIDENT_STATUS,
} from '../../constants/incident';

// ── Status timeline dot colours ────────────────────────────────────────────────
const STATUS_DOT = {
  reported:     'bg-zinc-500',
  acknowledged: 'bg-blue-500',
  responding:   'bg-yellow-500',
  resolved:     'bg-green-500',
  closed:       'bg-zinc-600',
  false_alarm:  'bg-zinc-600',
};

const STATUS_LABEL_COLOR = {
  reported:     'text-zinc-400',
  acknowledged: 'text-blue-400',
  responding:   'text-yellow-400',
  resolved:     'text-green-400',
  closed:       'text-zinc-500',
  false_alarm:  'text-zinc-500',
};

// ── Section wrapper ────────────────────────────────────────────────────────────
const Section = ({ title, icon: Icon, iconClass = 'text-zinc-400', children, defaultOpen = true }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2.5 px-5 py-4 hover:bg-zinc-800/50 transition"
      >
        <Icon className={`w-4 h-4 shrink-0 ${iconClass}`} />
        <span className="text-sm font-semibold text-zinc-200 flex-1 text-left">{title}</span>
        {open ? <ChevronUp className="w-3.5 h-3.5 text-zinc-600" /> : <ChevronDown className="w-3.5 h-3.5 text-zinc-600" />}
      </button>
      {open && <div className="px-5 pb-5">{children}</div>}
    </div>
  );
};

// ── Media viewer card ──────────────────────────────────────────────────────────
const MediaCard = ({ item }) => {
  const [expanded, setExpanded] = useState(false);

  if (item.type === 'image') {
    return (
      <div className="relative rounded-xl overflow-hidden border border-zinc-700 bg-zinc-800 cursor-pointer group aspect-video" onClick={() => setExpanded(true)}>
        <img src={item.url} alt={item.caption || 'Incident media'} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition flex items-center justify-center">
          <ExternalLink className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition" />
        </div>
        {expanded && (
          <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4" onClick={() => setExpanded(false)}>
            <img src={item.url} alt="" className="max-w-full max-h-full rounded-xl object-contain" />
          </div>
        )}
      </div>
    );
  }

  if (item.type === 'video') {
    return (
      <div className="rounded-xl overflow-hidden border border-zinc-700 bg-zinc-800 aspect-video">
        <video src={item.url} controls className="w-full h-full object-cover" />
      </div>
    );
  }

  // Document
  return (
    <a
      href={item.url}
      target="_blank"
      rel="noreferrer"
      className="flex items-center gap-3 p-3 bg-zinc-800 border border-zinc-700 rounded-xl hover:border-zinc-500 transition group"
    >
      <FileText className="w-6 h-6 text-zinc-400 group-hover:text-blue-400 transition" />
      <div className="min-w-0">
        <p className="text-xs font-semibold text-zinc-300 truncate">
          {item.caption || 'Document'}
        </p>
        <p className="text-[10px] text-zinc-500">Click to open</p>
      </div>
      <ExternalLink className="w-3.5 h-3.5 text-zinc-500 ml-auto" />
    </a>
  );
};

// ── Main component ─────────────────────────────────────────────────────────────
const IncidentDetail = () => {
  const { id }      = useParams();
  const { api }     = useAuth();
  const socket      = useSocket();
  const navigate    = useNavigate();

  const [incident,  setIncident]  = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchIncident = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get(`/incidents/${id}`);
      if (data.success) setIncident(data.incident);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load incident');
    } finally {
      setLoading(false);
    }
  }, [api, id]);

  useEffect(() => { fetchIncident(); }, [fetchIncident]);

  // ── Real-time status sync ──────────────────────────────────────────────────
  useEffect(() => {
    if (!socket || !id) return;
    const handler = (payload) => {
      if (payload.incidentId?.toString() !== id.toString()) return;
      setIncident(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          status:   payload.status   ?? prev.status,
          severity: payload.severity ?? prev.severity,
        };
      });
    };
    socket.on('incidentUpdated', handler);
    return () => socket.off('incidentUpdated', handler);
  }, [socket, id]);

  // ── Loading skeleton ───────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 p-4 space-y-4 max-w-2xl mx-auto pt-8">
        <div className="h-8  bg-zinc-900 border border-zinc-800 rounded-xl animate-pulse w-40" />
        <div className="h-36 bg-zinc-900 border border-zinc-800 rounded-2xl animate-pulse" />
        <div className="h-48 bg-zinc-900 border border-zinc-800 rounded-2xl animate-pulse" />
        <div className="h-64 bg-zinc-900 border border-zinc-800 rounded-2xl animate-pulse" />
      </div>
    );
  }

  // ── Error ──────────────────────────────────────────────────────────────────
  if (error || !incident) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center gap-4 p-6">
        <div className="flex items-center gap-3 p-4 bg-red-950/40 border border-red-800/40 rounded-xl text-red-400 text-sm max-w-sm w-full">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          {error || 'Incident not found'}
        </div>
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-xs text-zinc-400 hover:text-zinc-200 transition"
        >
          <ArrowLeft className="w-4 h-4" /> Go back
        </button>
      </div>
    );
  }

  const statusMeta   = INCIDENT_STATUS[incident.status] || INCIDENT_STATUS.reported;
  const isResolved   = ['resolved', 'closed'].includes(incident.status);
  const typeIcon     = TYPE_ICONS[incident.type] || '📍';
  const [lng, lat]   = incident.location?.coordinates || [0, 0];
  const hasMedia     = incident.media?.length > 0;
  const hasAiTriage  = incident.aiTriage?.summary;
  const hasAssigned  = incident.assignedResponders?.length > 0;

  const STATUS_STEPS = ['reported', 'acknowledged', 'responding', 'resolved'];
  const currentStepIdx = STATUS_STEPS.indexOf(incident.status);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Ambient */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[600px] h-64 bg-blue-600/4 rounded-full blur-3xl pointer-events-none" />

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 flex items-center gap-3 px-4 py-3 bg-zinc-900/80 backdrop-blur-md border-b border-zinc-800">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition px-2.5 py-1.5 rounded-lg hover:bg-zinc-800"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back
        </button>
        <div className="h-4 w-px bg-zinc-700/60" />
        <span className="text-sm font-bold text-zinc-100 truncate">{incident.title}</span>
        <button
          onClick={fetchIncident}
          className="ml-auto p-1.5 hover:bg-zinc-800 rounded-lg transition"
          title="Refresh"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-zinc-500 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </header>

      <div className="relative max-w-2xl mx-auto px-4 py-6 space-y-4">

        {/* ── Identity card ──────────────────────────────────────────────── */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
          {/* Severity accent */}
          <div className={`h-1 w-full ${SEVERITY_DOT[incident.severity] || 'bg-zinc-600'}`} />
          <div className="p-5">
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-xl bg-zinc-800 border border-zinc-700 flex items-center justify-center text-3xl shrink-0">
                {typeIcon}
              </div>
              <div className="flex-1 min-w-0">
                <h1 className="text-base font-black text-zinc-100 leading-snug">{incident.title}</h1>
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${SEVERITY_BADGE[incident.severity] || ''}`}>
                    {incident.severity?.toUpperCase()}
                  </span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${statusMeta.color}`}>
                    {statusMeta.label}
                  </span>
                  {incident.isSOS && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/30 animate-pulse">
                      🚨 SOS
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-zinc-600 mt-1.5 flex items-center gap-1">
                  <Clock className="w-2.5 h-2.5 shrink-0" />
                  {new Date(incident.createdAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                  {isResolved && incident.resolvedAt && (
                    <> · Resolved {new Date(incident.resolvedAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</>
                  )}
                </p>
              </div>
            </div>

            {/* Progress bar */}
            <div className="mt-4 pt-4 border-t border-zinc-800">
              <div className="flex items-center gap-1.5">
                {STATUS_STEPS.map((step, i) => (
                  <div key={step} className="flex items-center gap-1.5 flex-1">
                    <div className={`h-1.5 flex-1 rounded-full transition-all ${
                      i <= currentStepIdx || isResolved ? 'bg-blue-500' : 'bg-zinc-700'
                    }`} />
                  </div>
                ))}
              </div>
              <div className="flex justify-between mt-1">
                {STATUS_STEPS.map((step, i) => (
                  <span key={step} className={`text-[9px] capitalize ${i <= currentStepIdx || isResolved ? 'text-blue-400' : 'text-zinc-600'}`}>
                    {step}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── Description ────────────────────────────────────────────────── */}
        <Section title="Incident Description" icon={FileText}>
          <p className="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap">{incident.description}</p>
          <div className="flex flex-wrap gap-3 mt-4 pt-4 border-t border-zinc-800">
            <div className="text-xs text-zinc-500">
              <span className="text-zinc-400 font-semibold">Type: </span>
              <span className="capitalize">{incident.type?.replace('_', ' ')}</span>
            </div>
            {incident.affectedCount > 0 && (
              <div className="text-xs text-zinc-500">
                <span className="text-zinc-400 font-semibold">Affected: </span>
                ~{incident.affectedCount} people
              </div>
            )}
            {incident.evacuationRequired && (
              <span className="flex items-center gap-1 text-xs text-orange-400 bg-orange-500/10 border border-orange-500/20 px-2 py-0.5 rounded-full">
                <Shield className="w-3 h-3" /> Evacuation Required
              </span>
            )}
          </div>
        </Section>

        {/* ── Location ───────────────────────────────────────────────────── */}
        <Section title="Location" icon={MapPin} iconClass="text-red-400">
          <div className="space-y-3">
            <div className="flex items-start gap-2.5 p-3 bg-zinc-800/50 border border-zinc-700/50 rounded-xl">
              <MapPin className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm text-zinc-200">
                  {incident.location?.address || `${lat?.toFixed(5)}, ${lng?.toFixed(5)}`}
                </p>
                {(incident.location?.city || incident.location?.state) && (
                  <p className="text-xs text-zinc-500 mt-0.5">
                    {[incident.location.city, incident.location.state, incident.location.country]
                      .filter(Boolean).join(', ')}
                  </p>
                )}
                <p className="text-[10px] text-zinc-600 mt-1 font-mono">
                  {lat?.toFixed(6)}, {lng?.toFixed(6)}
                </p>
              </div>
            </div>
            {lat && lng && (
              <a
                href={`https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}&zoom=15`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-xl text-xs text-zinc-300 hover:text-zinc-100 transition"
              >
                <Navigation className="w-3.5 h-3.5 text-blue-400" />
                Open in OpenStreetMap
                <ExternalLink className="w-3 h-3 ml-auto text-zinc-600" />
              </a>
            )}
          </div>
        </Section>

        {/* ── AI Triage ───────────────────────────────────────────────────── */}
        {hasAiTriage && (
          <Section title="AI Triage Analysis" icon={Zap} iconClass="text-blue-400" defaultOpen={true}>
            <div className="space-y-4">
              {/* Summary */}
              <div className="p-3.5 bg-blue-950/20 border border-blue-900/30 rounded-xl">
                <p className="text-[10px] font-bold text-blue-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Zap className="w-3 h-3" /> AI Summary
                </p>
                <p className="text-sm text-blue-200/80 leading-relaxed">{incident.aiTriage.summary}</p>
              </div>

              {/* Risk + Affected */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-zinc-800/60 border border-zinc-700/50 rounded-xl text-center">
                  <p className={`text-2xl font-black ${
                    incident.aiTriage.riskScore >= 70 ? 'text-red-400' :
                    incident.aiTriage.riskScore >= 40 ? 'text-orange-400' :
                    'text-green-400'
                  }`}>
                    {incident.aiTriage.riskScore}
                    <span className="text-sm text-zinc-500">/100</span>
                  </p>
                  <p className="text-[10px] text-zinc-500 mt-0.5">Risk Score</p>
                </div>
                <div className="p-3 bg-zinc-800/60 border border-zinc-700/50 rounded-xl text-center">
                  <p className="text-2xl font-black text-zinc-100">
                    ~{incident.aiTriage.estimatedAffected || 0}
                  </p>
                  <p className="text-[10px] text-zinc-500 mt-0.5">Est. Affected</p>
                </div>
              </div>

              {/* Recommended Actions */}
              {incident.aiTriage.recommendedActions?.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-2">
                    Recommended Actions
                  </p>
                  <div className="space-y-1.5">
                    {incident.aiTriage.recommendedActions.map((action, i) => (
                      <div key={i} className="flex items-start gap-2.5 p-2.5 bg-zinc-800/50 border border-zinc-700/40 rounded-lg">
                        <div className="w-5 h-5 rounded-full bg-blue-600/20 border border-blue-600/30 flex items-center justify-center text-[10px] font-bold text-blue-400 shrink-0 mt-0.5">
                          {i + 1}
                        </div>
                        <p className="text-xs text-zinc-300 leading-relaxed">{action}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <p className="text-[10px] text-zinc-600 flex items-center gap-1">
                <Zap className="w-2.5 h-2.5" />
                Processed by {incident.aiTriage.modelUsed || 'Gemini AI'}
                {incident.aiTriage.processedAt && (
                  <> · {new Date(incident.aiTriage.processedAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</>
                )}
              </p>
            </div>
          </Section>
        )}

        {/* ── Assigned Responders ─────────────────────────────────────────── */}
        {hasAssigned && (
          <Section title={`Assigned Responders (${incident.assignedResponders.length})`} icon={Users} iconClass="text-green-400">
            <div className="space-y-2">
              {incident.assignedResponders.map(r => (
                <div key={r._id} className="flex items-center gap-3 p-2.5 bg-zinc-800/50 border border-zinc-700/40 rounded-xl">
                  <div className="w-8 h-8 rounded-full bg-green-600/20 border border-green-600/30 flex items-center justify-center text-sm font-bold text-green-400 shrink-0">
                    {r.avatar
                      ? <img src={r.avatar} alt={r.name} className="w-full h-full rounded-full object-cover" />
                      : (r.name?.[0] || 'R').toUpperCase()
                    }
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-zinc-200">{r.name}</p>
                    <p className="text-[10px] text-zinc-500 capitalize">{r.role?.replace('_', ' ')}</p>
                  </div>
                  <div className={`w-2 h-2 rounded-full shrink-0 ${r.isAvailable ? 'bg-green-400' : 'bg-zinc-500'}`} title={r.isAvailable ? 'Available' : 'Unavailable'} />
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* ── Media Gallery ───────────────────────────────────────────────── */}
        {hasMedia && (
          <Section title={`Evidence & Media (${incident.media.length})`} icon={Image} iconClass="text-purple-400">
            <div className="grid grid-cols-2 gap-3">
              {incident.media.map((item, i) => (
                <MediaCard key={item._id || i} item={item} />
              ))}
            </div>
          </Section>
        )}

        {/* ── Status Timeline ─────────────────────────────────────────────── */}
        {incident.statusHistory?.length > 0 && (
          <Section title="Status Timeline" icon={Activity} iconClass="text-yellow-400">
            <div className="relative pl-5">
              {/* Vertical line */}
              <div className="absolute left-[7px] top-2 bottom-2 w-px bg-zinc-700/60" />
              <div className="space-y-5">
                {[...incident.statusHistory].reverse().map((h, i) => (
                  <div key={i} className="relative flex items-start gap-3">
                    {/* Dot */}
                    <div className={`absolute -left-5 mt-1 w-3.5 h-3.5 rounded-full border-2 border-zinc-900 shrink-0 ${STATUS_DOT[h.status] || 'bg-zinc-600'}`} />
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
                        <p className="text-xs text-zinc-400 mt-0.5 leading-relaxed">{h.note}</p>
                      )}
                      <p className="text-[10px] text-zinc-600 mt-0.5 flex items-center gap-1">
                        <Clock className="w-2.5 h-2.5" />
                        {h.updatedAt
                          ? new Date(h.updatedAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                          : '—'}
                        {h.updatedBy?.name && (
                          <> · by <span className="text-zinc-500">{h.updatedBy.name}</span></>
                        )}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Section>
        )}

        {/* ── Reporter info ───────────────────────────────────────────────── */}
        {incident.reportedBy && (
          <Section title="Reported By" icon={Users} defaultOpen={false}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center font-bold text-zinc-400 shrink-0">
                {incident.reportedBy.avatar
                  ? <img src={incident.reportedBy.avatar} alt="" className="w-full h-full rounded-full object-cover" />
                  : (incident.reportedBy.name?.[0] || '?').toUpperCase()
                }
              </div>
              <div>
                <p className="text-sm font-semibold text-zinc-200">{incident.reportedBy.name}</p>
                <p className="text-xs text-zinc-500 capitalize">
                  {incident.reportedBy.role?.replace('_', ' ')}
                  {incident.reportedBy.phone && ` · ${incident.reportedBy.phone}`}
                </p>
              </div>
            </div>
          </Section>
        )}

        {/* Footer padding */}
        <div className="h-6" />
      </div>
    </div>
  );
};

export default IncidentDetail;
