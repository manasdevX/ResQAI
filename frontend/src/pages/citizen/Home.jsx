import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import SOSButton from '../../components/SOSButton';
import WeatherWidget from '../../components/WeatherWidget';
import ResourceRequestModal from '../../components/ResourceRequestModal';
import { AlertOctagon, Building2, Package, MessageCircle, FileText, CheckCircle, MapPin, Zap, X, Phone } from 'lucide-react';

import { SEVERITY_BADGE, TYPE_ICONS } from '../../constants/incident';

const EMERGENCY_CONTACTS = [
  { label: 'National Emergency', number: '112',  icon: '🆘', color: 'border-red-500/30 bg-red-500/8 hover:bg-red-500/15 text-red-300' },
  { label: 'Police',             number: '100',  icon: '👮', color: 'border-blue-500/30 bg-blue-500/8 hover:bg-blue-500/15 text-blue-300' },
  { label: 'Ambulance',          number: '108',  icon: '🚑', color: 'border-green-500/30 bg-green-500/8 hover:bg-green-500/15 text-green-300' },
  { label: 'Fire Brigade',       number: '101',  icon: '🔥', color: 'border-orange-500/30 bg-orange-500/8 hover:bg-orange-500/15 text-orange-300' },
  { label: 'Disaster Mgmt',      number: '1078', icon: '🏚️', color: 'border-purple-500/30 bg-purple-500/8 hover:bg-purple-500/15 text-purple-300' },
  { label: 'Women Helpline',     number: '1091', icon: '🤝', color: 'border-pink-500/30 bg-pink-500/8 hover:bg-pink-500/15 text-pink-300' },
];

const QUICK_ACTIONS = [
  { to: '/report',     icon: AlertOctagon,  label: 'Report Emergency', desc: 'Submit an incident with photos', color: 'border-red-600/30 hover:border-red-500/50 hover:bg-red-950/20' },
  { to: '/shelters',   icon: Building2,     label: 'Find Shelter',     desc: 'Hospitals & relief camps nearby', color: 'border-blue-600/30 hover:border-blue-500/50 hover:bg-blue-950/20' },
  { to: '/my-reports', icon: FileText,      label: 'My Reports',       desc: 'Track your incident reports', color: 'border-purple-600/30 hover:border-purple-500/50 hover:bg-purple-950/20' },
  { to: '/chat',       icon: MessageCircle, label: 'Chat',             desc: 'Talk to emergency teams', color: 'border-green-600/30 hover:border-green-500/50 hover:bg-green-950/20' },
];

const CitizenHome = () => {
  const { user, api } = useAuth();
  const socket = useSocket();

  const [nearbyIncidents,  setNearbyIncidents]  = useState([]);
  const [location,         setLocation]         = useState(null);
  const [locationError,    setLocationError]    = useState(null);
  const [showContacts,     setShowContacts]      = useState(false);
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
    const onAck = (payload) => {
      setSOSAcknowledged(payload);
      setTimeout(() => setSOSAcknowledged(null), 20000);
    };

    socket.on('sosAlert',        onSOS);
    socket.on('newIncident',     onNew);
    socket.on('sosAcknowledged', onAck);
    return () => {
      socket.off('sosAlert',        onSOS);
      socket.off('newIncident',     onNew);
      socket.off('sosAcknowledged', onAck);
    };
  }, [socket]);

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-8">

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
      <div className="flex items-center justify-between pb-2 border-b border-zinc-800/60">
        <div>
          <h1 className="text-2xl font-black text-zinc-100 tracking-tight">
            Hi, {user?.name?.split(' ')[0]} 👋
          </h1>
          <p className="text-sm text-zinc-500 mt-1">Stay safe. Help is always nearby.</p>
        </div>
        {location && (
          <div className="flex items-center gap-1.5 text-[11px] text-green-400 font-bold bg-green-500/10 border border-green-500/20 rounded-xl px-3 py-1.5 shadow-inner">
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

      {/* SOS + Action Cards */}
      <div className="space-y-2.5">
        <SOSButton />

        <div className="grid grid-cols-2 gap-2.5">
          {/* ── Emergency Contacts ── */}
          <button
            onClick={() => setShowContacts(true)}
            className="group flex flex-col gap-2 p-4 bg-red-500/8 hover:bg-red-500/15 border border-red-500/30 rounded-2xl text-left transition-all duration-300"
          >
            <div className="flex items-center justify-between">
              <div className="w-8 h-8 rounded-xl bg-red-500/15 flex items-center justify-center">
                <Phone className="w-4 h-4 text-red-400" />
              </div>
              <span className="text-[9px] font-black text-red-500/60 uppercase tracking-wider">Quick Dial</span>
            </div>
            <div>
              <p className="text-[13px] font-bold text-red-300 leading-tight">Emergency Contacts</p>
              <p className="text-[10px] text-red-500/60 mt-0.5 leading-snug">Police, ambulance, fire & more</p>
            </div>
          </button>

          {/* ── Request Resources ── */}
          <button
            onClick={() => setShowResources(true)}
            className="group flex flex-col gap-2 p-4 bg-orange-500/8 hover:bg-orange-500/15 border border-orange-500/30 rounded-2xl text-left transition-all duration-300"
          >
            <div className="w-8 h-8 rounded-xl bg-orange-500/15 flex items-center justify-center">
              <Package className="w-4 h-4 text-orange-400" />
            </div>
            <div>
              <p className="text-[13px] font-bold text-orange-300 leading-tight">Request Help</p>
              <p className="text-[10px] text-orange-500/60 mt-0.5 leading-snug">Food, water, medical & rescue</p>
            </div>
          </button>
        </div>
      </div>

      {/* Emergency Contacts modal */}
      {showContacts && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          onClick={() => setShowContacts(false)}
        >
          <div
            className="w-full max-w-sm bg-zinc-900 border border-zinc-700/80 rounded-2xl p-5 shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-red-500/15 flex items-center justify-center">
                  <Phone className="w-4 h-4 text-red-400" />
                </div>
                <div>
                  <p className="text-sm font-black text-zinc-100">Emergency Contacts</p>
                  <p className="text-[10px] text-zinc-500">Tap a number to call instantly</p>
                </div>
              </div>
              <button
                onClick={() => setShowContacts(false)}
                className="p-1.5 rounded-lg hover:bg-zinc-800 transition-colors"
                aria-label="Close"
              >
                <X className="w-4 h-4 text-zinc-500" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {EMERGENCY_CONTACTS.map(({ label, number, icon, color }) => (
                <a
                  key={number}
                  href={`tel:${number}`}
                  className={`flex items-center gap-2.5 p-3 rounded-xl border transition-all duration-200 ${color}`}
                >
                  <span className="text-lg leading-none shrink-0">{icon}</span>
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold text-zinc-400 truncate">{label}</p>
                    <p className="text-base font-black tabular-nums leading-tight">{number}</p>
                  </div>
                </a>
              ))}
            </div>

            <p className="text-[10px] text-zinc-600 text-center mt-4">
              These are India's national emergency helplines
            </p>
          </div>
        </div>
      )}

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
              className={`flex flex-col gap-3 p-5 bg-zinc-900/40 backdrop-blur-md border rounded-2xl transition-all duration-300 group card-hover ${color}`}
            >
              <div className="w-10 h-10 rounded-xl bg-zinc-800/80 flex items-center justify-center group-hover:bg-zinc-700/80 transition-colors shadow-sm">
                <Icon className="w-5 h-5 text-zinc-400 group-hover:text-zinc-100 transition-colors" />
              </div>
              <div>
                <p className="text-[15px] font-bold text-zinc-200 leading-tight group-hover:text-white transition-colors">{label}</p>
                <p className="text-xs text-zinc-500 mt-1 leading-snug">{desc}</p>
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

          <div className="space-y-3">
            {nearbyIncidents.map(inc => (
              <Link key={inc._id} to={`/incidents/${inc._id}`} className="block">
                <div className="flex items-start gap-4 p-4 bg-zinc-900/50 backdrop-blur-sm border border-zinc-800/80 rounded-2xl card-hover transition-colors hover:bg-zinc-800/60">
                  <div className="w-10 h-10 rounded-xl bg-zinc-800 flex items-center justify-center shrink-0 shadow-inner text-xl">
                    {TYPE_ICONS[inc.type] || '📍'}
                  </div>
                  <div className="flex-1 min-w-0 pt-0.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[15px] font-bold text-zinc-100 truncate">{inc.title}</p>
                      <span className={`shrink-0 text-[10px] font-black tracking-wider uppercase px-2 py-0.5 rounded-full border ${SEVERITY_BADGE[inc.severity]}`}>
                        {inc.severity}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-500 mt-1 truncate flex items-center gap-1.5 font-medium">
                      <MapPin className="w-3 h-3 shrink-0 text-zinc-600" />
                      {inc.location?.address || 'Nearby'}
                    </p>
                    {inc.aiTriage?.recommendedActions?.[0] && (
                      <div className="mt-2.5 p-2 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                        <p className="text-[11px] text-blue-300 flex items-center gap-1.5 font-medium leading-snug">
                          <Zap className="w-3 h-3 shrink-0 text-blue-400" />
                          {inc.aiTriage.recommendedActions[0]}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </Link>
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
