import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import WeatherWidget from '../../components/WeatherWidget';
import { MapPin, ClipboardList, Package, MessageCircle, Zap, Users, AlertTriangle, Plus, X } from 'lucide-react';

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
          className={`flex items-start gap-3 p-4 border-2 rounded-2xl ${
            alert.isSOS
              ? 'bg-red-950/70 border-red-600/60 animate-pulse'
              : 'bg-blue-950/60 border-blue-600/50'
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

      {/* Header */}
      <div>
        <h1 className="text-xl font-black text-zinc-100">Welcome back, {user?.name?.split(' ')[0]}</h1>
        <p className="text-sm text-zinc-500 mt-0.5">
          {user?.isAvailable ? '🟢 You are ON DUTY — volunteers can see you' : '⚪ You are OFF DUTY — toggle to go active'}
        </p>
        <p className="text-[11px] text-zinc-600 mt-1 flex items-center gap-1">
          {gpsStatus === 'detecting' && <><span className="inline-block w-2 h-2 rounded-full bg-yellow-500 animate-pulse" /> Detecting your location…</>}
          {gpsStatus === 'granted'   && <><span className="inline-block w-2 h-2 rounded-full bg-green-500" /> Showing stats for your area</>}
          {gpsStatus === 'denied'    && <><span className="inline-block w-2 h-2 rounded-full bg-zinc-600" /> Location unavailable — showing global stats</>}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Active Incidents',  value: stats.active,  icon: AlertTriangle, color: 'text-red-400',    bg: 'bg-red-500/10 border-red-500/20' },
          { label: 'My Assignments',    value: stats.mine,    icon: ClipboardList, color: 'text-blue-400',   bg: 'bg-blue-500/10 border-blue-500/20' },
          { label: gpsLocation ? 'Nearby Resources' : 'Resource Requests', value: stats.resources, icon: Package, color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/20' },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className={`flex flex-col items-center gap-1.5 p-4 rounded-2xl border ${bg}`}>
            <Icon className={`w-5 h-5 ${color}`} />
            <p className="text-2xl font-black text-zinc-100">{value}</p>
            <p className="text-[10px] text-zinc-500 text-center font-medium">{label}</p>
          </div>
        ))}
      </div>


      {/* Quick links */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { to: '/volunteer/incidents',   icon: MapPin,        label: 'View Nearby Incidents', color: 'hover:border-blue-500/40 hover:bg-blue-950/20' },
          { to: '/volunteer/assignments', icon: ClipboardList, label: 'My Assignments',        color: 'hover:border-purple-500/40 hover:bg-purple-950/20' },
          { to: '/volunteer/resources',   icon: Package,       label: 'Fulfill Resources',     color: 'hover:border-orange-500/40 hover:bg-orange-950/20' },
          { to: '/volunteer/chat',        icon: MessageCircle, label: 'Open Chat',             color: 'hover:border-green-500/40 hover:bg-green-950/20' },
        ].map(({ to, icon: Icon, label, color }) => (
          <Link
            key={to}
            to={to}
            className={`flex items-center gap-2.5 p-3.5 bg-zinc-900 border border-zinc-800 rounded-xl text-sm font-medium text-zinc-300 hover:text-zinc-100 transition-all ${color}`}
          >
            <Icon className="w-4 h-4 text-zinc-500" /> {label}
          </Link>
        ))}
      </div>

      {/* Skills */}
      <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-2xl space-y-3">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-yellow-400" />
          <p className="text-sm font-semibold text-zinc-200">My Skills</p>
        </div>

        <div className="flex flex-wrap gap-2">
          {skills.map(skill => (
            <span
              key={skill}
              className="flex items-center gap-1.5 text-xs px-2.5 py-1 bg-blue-500/10 border border-blue-500/20 text-blue-300 rounded-full"
            >
              {skill}
              <button onClick={() => removeSkill(skill)} className="hover:text-red-400 transition">
                <X className="w-2.5 h-2.5" />
              </button>
            </span>
          ))}

          {skills.length === 0 && (
            <p className="text-xs text-zinc-600">No skills added yet. Add your expertise so admins can assign you better.</p>
          )}
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            value={newSkill}
            onChange={e => setNewSkill(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addSkill()}
            placeholder="e.g. first aid, driving, search & rescue…"
            className="flex-1 px-3 py-1.5 bg-zinc-800 border border-zinc-700 rounded-lg text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-blue-500 transition"
          />
          <button
            onClick={addSkill}
            disabled={skillSaving || !newSkill.trim()}
            className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg text-xs font-semibold transition"
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
