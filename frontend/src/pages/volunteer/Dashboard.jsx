import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import WeatherWidget from '../../components/WeatherWidget';
import { MapPin, ClipboardList, Package, MessageCircle, Zap, AlertTriangle, Plus, X } from 'lucide-react';

const VolunteerDashboard = () => {
  const { user, api, updateUser } = useAuth();
  const socket = useSocket();

  const [stats,           setStats]           = useState({ active: 0, mine: 0, resources: 0 });
  const [skills,          setSkills]          = useState(user?.skills || []);
  const [newSkill,        setNewSkill]        = useState('');
  const [skillSaving,     setSkillSaving]     = useState(false);
  const [sosAlerts,       setSOSAlerts]       = useState([]);
  const [dispatchAlerts,  setDispatchAlerts]  = useState([]);
  const [gpsLocation,     setGpsLocation]     = useState(null);
  const [gpsStatus,       setGpsStatus]       = useState('detecting'); // detecting | granted | denied

  // Get real GPS location on mount
  useEffect(() => {
    if (!navigator.geolocation) {
      setGpsStatus('denied');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGpsLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGpsStatus('granted');
      },
      () => setGpsStatus('denied'),
      { timeout: 10000, maximumAge: 120000 }
    );
  }, []);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        // Use real GPS if available; fallback to a wide global fetch so the stat is still meaningful
        const lat = gpsLocation?.lat ?? 0;
        const lng = gpsLocation?.lng ?? 0;
        const dist = gpsLocation ? 20000 : 99999999; // 20 km vs global

        const [incRes, allRes] = await Promise.all([
          api.get('/incidents?limit=200'),
          api.get(`/resources/nearby?lat=${lat}&lng=${lng}&maxDistance=${dist}`).catch(() => ({ data: { requests: [] } })),
        ]);
        const incidents = incRes.data.incidents || [];
        const activeCount = incidents.filter(i => !['resolved', 'closed'].includes(i.status)).length;
        const mineCount   = incidents.filter(i =>
          i.assignedResponders?.some(r => (r?._id?.toString() || r?.toString()) === user?._id?.toString())
        ).length;
        setStats({
          active:    activeCount,
          mine:      mineCount,
          resources: (allRes.data.requests || []).length,
        });
      } catch { /* silent */ }
    };
    // Fetch once GPS resolves (or if denied, fetch immediately with fallback)
    if (gpsStatus !== 'detecting') fetchStats();
  }, [api, user, gpsStatus, gpsLocation]);


  useEffect(() => {
    if (!socket) return;

    const onSOS = (payload) => {
      setSOSAlerts(prev => [payload, ...prev].slice(0, 3));
      setTimeout(() => setSOSAlerts(prev => prev.filter(a => a.incidentId !== payload.incidentId)), 15000);
    };

    // Fired when a new incident is dispatched to this responder based on skill match
    const onDispatched = (payload) => {
      const id = payload.incidentId?.toString();
      setDispatchAlerts(prev => [payload, ...prev].slice(0, 5));
      setTimeout(() => setDispatchAlerts(prev => prev.filter(a => a.incidentId?.toString() !== id)), 30000);
      // Increment active count so the stat badge refreshes
      setStats(prev => ({ ...prev, active: prev.active + 1 }));
    };

    socket.on('sosAlert',            onSOS);
    socket.on('newIncidentAssigned', onDispatched);
    return () => {
      socket.off('sosAlert',            onSOS);
      socket.off('newIncidentAssigned', onDispatched);
    };
  }, [socket]);

  const addSkill = async () => {
    const trimmed = newSkill.trim().toLowerCase();
    if (!trimmed || skills.includes(trimmed)) { setNewSkill(''); return; }
    const updated = [...skills, trimmed];
    setSkillSaving(true);
    try {
      await api.patch('/users/skills', { skills: updated });
      setSkills(updated);
      updateUser({ skills: updated });
      setNewSkill('');
    } catch { /* silent */ } finally {
      setSkillSaving(false);
    }
  };

  const removeSkill = async (skill) => {
    const updated = skills.filter(s => s !== skill);
    try {
      await api.patch('/users/skills', { skills: updated });
      setSkills(updated);
      updateUser({ skills: updated });
    } catch { /* silent */ }
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">

      {/* Dispatch alerts — incidents matched to this responder's skills */}
      {dispatchAlerts.map(alert => (
        <div
          key={alert.incidentId?.toString()}
          className={`flex items-start gap-3 p-4 border-2 rounded-2xl backdrop-blur-md shadow-lg ${
            alert.isSOS
              ? 'bg-red-950/40 border-red-500/50 shadow-[0_0_20px_rgba(239,68,68,0.15)] animate-pulse'
              : 'bg-blue-950/40 border-blue-500/40 shadow-[0_0_20px_rgba(59,130,246,0.1)]'
          }`}
        >
          <span className="text-xl shrink-0">{alert.isSOS ? '🚨' : '📋'}</span>
          <div className="flex-1 min-w-0">
            <p className={`text-sm font-bold ${alert.isSOS ? 'text-red-300' : 'text-blue-300'}`}>
              {alert.isSOS ? 'SOS — Dispatched to you' : 'New incident assigned to you'}
            </p>
            <p className="text-xs font-semibold text-zinc-200 mt-0.5 truncate">{alert.title}</p>
            <p className={`text-xs mt-0.5 ${alert.isSOS ? 'text-red-400/70' : 'text-blue-400/70'}`}>
              {alert.severity?.toUpperCase()} · {alert.type} · Go to Nearby Incidents to accept
            </p>
            {alert.aiSummary && (
              <p className="text-xs text-zinc-400 mt-1 line-clamp-1">{alert.aiSummary}</p>
            )}
          </div>
          <button
            onClick={() => setDispatchAlerts(prev => prev.filter(a => a.incidentId?.toString() !== alert.incidentId?.toString()))}
            className={alert.isSOS ? 'text-red-400 hover:text-red-200' : 'text-blue-400 hover:text-blue-200'}
            aria-label="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}

      {/* SOS alerts from nearby users */}
      {sosAlerts.map(alert => (
        <div key={alert.incidentId} className="flex items-start gap-3 p-4 bg-red-950/70 border-2 border-red-600/60 rounded-2xl animate-pulse">
          <span className="text-2xl shrink-0">🚨</span>
          <div className="flex-1">
            <p className="text-sm font-bold text-red-300">SOS Alert — {alert.user?.name}</p>
            <p className="text-xs text-red-400/70 mt-0.5">Requires immediate response. Check Nearby Incidents.</p>
          </div>
          <button onClick={() => setSOSAlerts(prev => prev.filter(a => a.incidentId !== alert.incidentId))}>
            <X className="w-4 h-4 text-red-400" />
          </button>
        </div>
      ))}

      {/* Header + Duty status */}
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-black text-zinc-100 tracking-tight">
              Welcome back, {user?.name?.split(' ')[0]}
            </h1>
            <p className="text-xs text-zinc-500 mt-0.5 flex items-center gap-1.5">
              {gpsStatus === 'detecting' && (
                <><span className="inline-flex w-1.5 h-1.5 rounded-full bg-yellow-500 animate-pulse" /> Detecting location…</>
              )}
              {gpsStatus === 'granted' && (
                <><span className="inline-flex w-1.5 h-1.5 rounded-full bg-green-500" /> Showing stats for your area</>
              )}
              {gpsStatus === 'denied' && (
                <><span className="inline-flex w-1.5 h-1.5 rounded-full bg-zinc-600" /> Global stats</>
              )}
            </p>
          </div>

          {/* Compact duty toggle chip */}
          <div className={`shrink-0 flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-bold transition-all ${
            user?.isAvailable
              ? 'bg-green-500/12 border-green-500/25 text-green-400'
              : 'bg-zinc-800/60 border-zinc-700/50 text-zinc-500'
          }`}>
            {user?.isAvailable ? (
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-60" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
              </span>
            ) : (
              <span className="w-2 h-2 rounded-full bg-zinc-600" />
            )}
            {user?.isAvailable ? 'ON DUTY' : 'OFF DUTY'}
          </div>
        </div>

        {/* Duty status prominent card */}
        <div className={`p-5 rounded-2xl border transition-all duration-300 ${
            user?.isAvailable
              ? 'bg-green-950/20 border-green-500/40 shadow-[0_0_30px_rgba(34,197,94,0.1)] backdrop-blur-sm'
              : 'bg-zinc-900/40 border-zinc-800/80 backdrop-blur-sm'
          }`}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className={`text-sm font-bold ${user?.isAvailable ? 'text-green-300' : 'text-zinc-400'}`}>
                  {user?.isAvailable ? 'You are on duty' : 'You are off duty'}
                </p>
                <p className={`text-xs mt-0.5 ${user?.isAvailable ? 'text-green-400/70' : 'text-zinc-600'}`}>
                  {user?.isAvailable
                    ? 'Dispatchers can see you and assign incidents'
                    : 'Toggle ON DUTY in the sidebar to start receiving assignments'}
                </p>
              </div>
              <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                user?.isAvailable ? 'bg-green-500/20' : 'bg-zinc-800'
              }`}>
                <Zap className={`w-5 h-5 ${user?.isAvailable ? 'text-green-400' : 'text-zinc-600'}`} />
              </div>
            </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Active',      value: stats.active,    icon: AlertTriangle, color: 'text-red-400',    bg: 'bg-red-500/10 border-red-500/20',    to: '/volunteer/incidents'   },
          { label: 'Assigned',    value: stats.mine,      icon: ClipboardList, color: 'text-blue-400',   bg: 'bg-blue-500/10 border-blue-500/20',   to: '/volunteer/assignments' },
          { label: 'Resources',   value: stats.resources, icon: Package,       color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/20', to: '/volunteer/resources'  },
        ].map(({ label, value, icon: Icon, color, bg, to }) => (
          <Link
            key={label}
            to={to}
            className={`flex flex-col items-center gap-1.5 p-4 rounded-2xl border transition-all card-hover ${bg}`}
          >
            <Icon className={`w-4 h-4 ${color}`} />
            <p className="text-2xl font-black text-zinc-100 tabular-nums">{value}</p>
            <p className="text-[10px] text-zinc-500 text-center font-semibold uppercase tracking-wide">{label}</p>
          </Link>
        ))}
      </div>


      {/* Quick links */}
      <div>
        <p className="section-label">Quick Actions</p>
        <div className="grid grid-cols-2 gap-2.5">
          {[
            { to: '/volunteer/incidents',   icon: MapPin,        label: 'Nearby Incidents',  desc: 'View active nearby',    color: 'hover:border-blue-500/30 hover:bg-blue-950/15'   },
            { to: '/volunteer/assignments', icon: ClipboardList, label: 'My Assignments',    desc: 'Incidents assigned',    color: 'hover:border-purple-500/30 hover:bg-purple-950/15' },
            { to: '/volunteer/resources',   icon: Package,       label: 'Fulfill Resources', desc: 'Help requests nearby',  color: 'hover:border-orange-500/30 hover:bg-orange-950/15' },
            { to: '/volunteer/chat',        icon: MessageCircle, label: 'Open Chat',         desc: 'Talk to your team',     color: 'hover:border-green-500/30 hover:bg-green-950/15'  },
          ].map(({ to, icon: Icon, label, desc, color }) => (
            <Link
              key={to}
              to={to}
              className={`flex flex-col gap-3 p-5 bg-zinc-900/40 backdrop-blur-md border border-zinc-800/80 rounded-2xl transition-all duration-300 group card-hover ${color}`}
            >
              <div className="w-10 h-10 rounded-xl bg-zinc-800 flex items-center justify-center group-hover:bg-zinc-700/80 transition-colors shadow-sm">
                <Icon className="w-5 h-5 text-zinc-400 group-hover:text-zinc-100 transition-colors" />
              </div>
              <div>
                <p className="text-[15px] font-bold text-zinc-200 group-hover:text-white transition-colors">{label}</p>
                <p className="text-xs text-zinc-500 mt-1">{desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Skills */}
      <div className="p-4 bg-zinc-900/80 border border-zinc-800/80 rounded-2xl space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-yellow-500/10 flex items-center justify-center">
              <Zap className="w-3.5 h-3.5 text-yellow-400" />
            </div>
            <p className="text-sm font-bold text-zinc-200">My Skills</p>
          </div>
          {skills.length > 0 && (
            <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-wider">{skills.length} skill{skills.length !== 1 ? 's' : ''}</span>
          )}
        </div>

        <div className="flex flex-wrap gap-1.5">
          {skills.map(skill => (
              <span
              key={skill}
              className="flex items-center gap-1.5 text-[11px] font-bold tracking-wide px-3 py-1.5 bg-blue-500/10 border border-blue-500/30 text-blue-300 rounded-full capitalize"
            >
              {skill}
              <button onClick={() => removeSkill(skill)} className="hover:text-red-400 transition-colors ml-0.5 opacity-60 hover:opacity-100" aria-label={`Remove ${skill}`}>
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}

          {skills.length === 0 && (
            <p className="text-xs text-zinc-600 leading-relaxed">No skills added yet. Add your expertise so admins can match you to relevant incidents.</p>
          )}
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            value={newSkill}
            onChange={e => setNewSkill(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addSkill()}
            placeholder="e.g. first aid, driving, search & rescue…"
            className="flex-1 px-3 py-2 bg-zinc-800/80 border border-zinc-700/60 rounded-xl text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/20 transition-all"
          />
          <button
            onClick={addSkill}
            disabled={skillSaving || !newSkill.trim()}
            className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold transition-all"
          >
            <Plus className="w-3 h-3" /> Add
          </button>
        </div>
      </div>

      {/* Weather */}
      <WeatherWidget compact />
    </div>
  );
};

export default VolunteerDashboard;
