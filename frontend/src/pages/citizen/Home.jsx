import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import SOSButton from '../../components/SOSButton';
import WeatherWidget from '../../components/WeatherWidget';
import ResourceRequestModal from '../../components/ResourceRequestModal';
import { AlertOctagon, Building2, Package, MessageCircle, FileText, CheckCircle, MapPin, Zap, X } from 'lucide-react';

import { SEVERITY_BADGE, TYPE_ICONS } from '../../constants/incident';

const QUICK_ACTIONS = [
  { to: '/report',     icon: AlertOctagon,  label: 'Report Emergency', desc: 'Submit an incident with photos', color: 'border-red-600/30 hover:border-red-500/50 hover:bg-red-950/20' },
  { to: '/shelters',   icon: Building2,     label: 'Find Shelter',     desc: 'Hospitals & relief camps nearby', color: 'border-blue-600/30 hover:border-blue-500/50 hover:bg-blue-950/20' },
  { to: '/my-reports', icon: FileText,      label: 'My Reports',       desc: 'Track your incident reports', color: 'border-purple-600/30 hover:border-purple-500/50 hover:bg-purple-950/20' },
  { to: '/chat',       icon: MessageCircle, label: 'Chat',             desc: 'Talk to responders', color: 'border-green-600/30 hover:border-green-500/50 hover:bg-green-950/20' },
];

const CitizenHome = () => {
  const { user, api, updateUser } = useAuth();
  const socket = useSocket();

  const [nearbyIncidents,  setNearbyIncidents]  = useState([]);
  const [location,         setLocation]         = useState(null);
  const [locationError,    setLocationError]    = useState(null);
  const [markingSafe,      setMarkingSafe]       = useState(false);
  const [showResources,    setShowResources]     = useState(false);
  const [sosAlert,         setSOSAlert]          = useState(null);
  const [sosAcknowledged,  setSOSAcknowledged]   = useState(null);

  // Get location + nearby incidents on mount
  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setLocation(loc);
        try {
          const { data } = await api.get(`/incidents/nearby?lat=${loc.lat}&lng=${loc.lng}&maxDistance=20000`);
          setNearbyIncidents(data.incidents?.slice(0, 5) || []);
        } catch { /* silent — nearby incidents are non-critical */ }
      },
      (err) => {
        const msg = err.code === 1
          ? 'Location access denied — enable it in browser settings to see nearby incidents'
          : 'Unable to get your location';
        setLocationError(msg);
      },
      { timeout: 10000, maximumAge: 120000 }
    );
  }, [api]);

  // Socket: listen for SOS alerts, new incidents, and SOS acknowledgments
  useEffect(() => {
    if (!socket) return;

    const onSOS = (payload) => {
      setSOSAlert(payload);
      setTimeout(() => setSOSAlert(null), 10000);
    };
    const onNew = (incident) => setNearbyIncidents(prev => [incident, ...prev].slice(0, 5));
    // Fired when a responder accepts OUR SOS — only reaches this user's socket room
    const onAck = (payload) => {
      setSOSAcknowledged(payload);
      setTimeout(() => setSOSAcknowledged(null), 20000);
    };

    socket.on('sosAlert',       onSOS);
    socket.on('newIncident',    onNew);
    socket.on('sosAcknowledged', onAck);
    return () => {
      socket.off('sosAlert',       onSOS);
      socket.off('newIncident',    onNew);
      socket.off('sosAcknowledged', onAck);
    };
  }, [socket]);

  // Two-way safety toggle: Safe ⇄ Need Help. Sends the desired state so a
  // citizen can both confirm they're safe and flag that they need help.
  const handleToggleSafe = async () => {
    const next = !user?.isSafe;
    setMarkingSafe(true);
    try {
      const { data } = await api.patch('/users/safe', { isSafe: next });
      updateUser({ isSafe: typeof data?.isSafe === 'boolean' ? data.isSafe : next });
    } catch { /* silent */ } finally {
      setMarkingSafe(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">

      {/* SOS Acknowledged banner */}
      {sosAcknowledged && (
        <div className="flex items-start gap-3 p-4 bg-green-950/60 border-2 border-green-600/50 rounded-2xl animate-fade-up">
          <div className="w-9 h-9 rounded-xl bg-green-500/20 flex items-center justify-center shrink-0">
            <CheckCircle className="w-5 h-5 text-green-400" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold text-green-300">Help is on the way!</p>
            <p className="text-xs text-green-400/80 mt-0.5 leading-relaxed">
              {sosAcknowledged.responder?.name
                ? <><span className="font-semibold text-green-300">{sosAcknowledged.responder.name}</span> has accepted your emergency and is responding.</>
                : 'A responder has accepted your emergency and is responding.'}
            </p>
            <p className="text-xs text-green-600/80 mt-1">Stay safe and wait for assistance.</p>
          </div>
          <button
            onClick={() => setSOSAcknowledged(null)}
            className="text-green-600 hover:text-green-400 transition-colors shrink-0 p-1 rounded-lg hover:bg-green-900/30"
            aria-label="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* SOS Alert banner */}
      {sosAlert && (
        <div className="flex items-start gap-3 p-4 bg-red-950/70 border-2 border-red-600/50 rounded-2xl">
          <div className="w-9 h-9 rounded-xl bg-red-500/20 flex items-center justify-center shrink-0 animate-sos-pulse">
            <span className="text-lg">🚨</span>
          </div>
          <div>
            <p className="text-sm font-bold text-red-300">SOS Alert Nearby</p>
            <p className="text-xs text-red-400/70 mt-0.5">{sosAlert.user?.name} has triggered an SOS emergency.</p>
          </div>
        </div>
      )}

      {/* Greeting */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black text-zinc-100 tracking-tight">
            Hi, {user?.name?.split(' ')[0]} 👋
          </h1>
          <p className="text-sm text-zinc-500 mt-0.5">Stay safe. Help is always nearby.</p>
        </div>
        {location && (
          <div className="flex items-center gap-1.5 text-[11px] text-green-400/80 font-medium bg-green-950/30 border border-green-800/30 rounded-lg px-2.5 py-1.5">
            <MapPin className="w-3 h-3 shrink-0" />
            <span>Location active</span>
          </div>
        )}
      </div>

      {locationError && (
        <div className="flex items-center gap-2.5 p-3 bg-zinc-800/50 border border-zinc-700/40 rounded-xl text-zinc-400 text-xs">
          <MapPin className="w-3.5 h-3.5 shrink-0 text-zinc-500" />
          <span>{locationError}</span>
        </div>
      )}

      {/* SOS + Mark Safe */}
      <div className="space-y-2.5">
        <SOSButton />

        <div className="grid grid-cols-2 gap-2.5">
          {/* Safety status — two-way toggle (Safe ⇄ Need Help) */}
          <button
            onClick={handleToggleSafe}
            disabled={markingSafe}
            aria-pressed={!!user?.isSafe}
            title={user?.isSafe
              ? "You're marked safe — tap if you need help"
              : 'Tap to mark yourself safe'}
            className={`flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-semibold transition-all disabled:opacity-60 ${
              user?.isSafe
                ? 'bg-green-700/15 hover:bg-green-700/25 border border-green-600/35 text-green-400'
                : 'bg-amber-700/15 hover:bg-amber-700/25 border border-amber-600/40 text-amber-400'
            }`}
          >
            {user?.isSafe
              ? <CheckCircle className="w-4 h-4 shrink-0" />
              : <AlertOctagon className="w-4 h-4 shrink-0" />}
            {markingSafe ? 'Updating…' : (user?.isSafe ? "You're Safe" : 'Mark Safe')}
          </button>

          {/* Request Resources */}
          <button
            onClick={() => setShowResources(true)}
            className="flex items-center justify-center gap-2 py-3 bg-orange-700/12 hover:bg-orange-700/22 border border-orange-600/25 rounded-xl text-orange-400 text-xs font-semibold transition-all"
          >
            <Package className="w-4 h-4 shrink-0" />
            Request Help
          </button>
        </div>
      </div>

      {/* Weather */}
      <WeatherWidget />

      {/* Quick actions */}
      <div>
        <p className="section-label">Quick Actions</p>
        <div className="grid grid-cols-2 gap-2.5">
          {QUICK_ACTIONS.map(({ to, icon: Icon, label, desc, color }) => (
            <Link
              key={to}
              to={to}
              className={`flex flex-col gap-2.5 p-4 bg-zinc-900/80 border rounded-2xl transition-all duration-200 group card-hover ${color}`}
            >
              <div className="w-8 h-8 rounded-lg bg-zinc-800/80 flex items-center justify-center group-hover:bg-zinc-700/60 transition-colors">
                <Icon className="w-4 h-4 text-zinc-400 group-hover:text-zinc-200 transition-colors" />
              </div>
              <div>
                <p className="text-sm font-semibold text-zinc-200 leading-tight">{label}</p>
                <p className="text-xs text-zinc-500 mt-0.5 leading-snug">{desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Nearby incidents */}
      {nearbyIncidents.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="section-label mb-0">Nearby Incidents</p>
            <span className="flex items-center gap-1.5 text-[10px] text-red-400 font-bold">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500" />
              </span>
              LIVE
            </span>
          </div>

          <div className="space-y-2">
            {nearbyIncidents.map(inc => (
              <div key={inc._id} className="flex items-start gap-3 p-3.5 bg-zinc-900/80 border border-zinc-800/80 rounded-xl card-hover cursor-default">
                <span className="text-xl shrink-0 mt-0.5">{TYPE_ICONS[inc.type] || '📍'}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-zinc-200 truncate">{inc.title}</p>
                    <span className={`shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${SEVERITY_BADGE[inc.severity]}`}>
                      {inc.severity?.toUpperCase()}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-500 mt-0.5 truncate flex items-center gap-1">
                    <MapPin className="w-2.5 h-2.5 shrink-0" />
                    {inc.location?.address || 'Nearby'}
                  </p>
                  {inc.aiTriage?.recommendedActions?.[0] && (
                    <p className="text-[11px] text-blue-400/80 mt-1 flex items-center gap-1 leading-snug">
                      <Zap className="w-2.5 h-2.5 shrink-0" />
                      {inc.aiTriage.recommendedActions[0]}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {location && nearbyIncidents.length === 0 && (
        <div className="text-center py-10 text-zinc-600">
          <div className="w-14 h-14 rounded-full bg-zinc-800/60 border border-zinc-700/40 flex items-center justify-center mx-auto mb-3">
            <span className="text-2xl">🛡️</span>
          </div>
          <p className="text-sm font-medium text-zinc-500">No active incidents near you</p>
          <p className="text-xs text-zinc-600 mt-1">Stay safe and alert</p>
        </div>
      )}

      {/* Resource modal */}
      {showResources && (
        <ResourceRequestModal
          onClose={() => setShowResources(false)}
          onSuccess={() => setShowResources(false)}
        />
      )}
    </div>
  );
};

export default CitizenHome;
