import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import SOSButton from '../../components/SOSButton';
import WeatherWidget from '../../components/WeatherWidget';
import ResourceRequestModal from '../../components/ResourceRequestModal';
import { AlertOctagon, Building2, Package, MessageCircle, FileText, CheckCircle, MapPin, Clock, Zap } from 'lucide-react';

const SEVERITY_COLORS = {
  critical: 'text-red-400 bg-red-500/10 border-red-500/30',
  high:     'text-orange-400 bg-orange-500/10 border-orange-500/30',
  medium:   'text-yellow-400 bg-yellow-500/10 border-yellow-500/30',
  low:      'text-green-400 bg-green-500/10 border-green-500/30',
};

const TYPE_ICONS = {
  fire: '🔥', flood: '🌊', earthquake: '🌍', cyclone: '🌀',
  landslide: '🏔️', accident: '🚗', medical_emergency: '🚑',
  building_collapse: '🏚️', chemical_spill: '☣️', riot: '⚠️', other: '📍',
};

const QUICK_ACTIONS = [
  { to: '/report',     icon: AlertOctagon,  label: 'Report Emergency', desc: 'Submit an incident with photos', color: 'border-red-600/30 hover:border-red-500/50 hover:bg-red-950/20' },
  { to: '/shelters',   icon: Building2,     label: 'Find Shelter',     desc: 'Hospitals & relief camps nearby', color: 'border-blue-600/30 hover:border-blue-500/50 hover:bg-blue-950/20' },
  { to: '/my-reports', icon: FileText,      label: 'My Reports',       desc: 'Track your incident reports', color: 'border-purple-600/30 hover:border-purple-500/50 hover:bg-purple-950/20' },
  { to: '/chat',       icon: MessageCircle, label: 'Chat',             desc: 'Talk to responders', color: 'border-green-600/30 hover:border-green-500/50 hover:bg-green-950/20' },
];

const CitizenHome = () => {
  const { user, api, updateUser } = useAuth();
  const socket = useSocket();

  const [nearbyIncidents, setNearbyIncidents] = useState([]);
  const [location,        setLocation]        = useState(null);
  const [markingSafe,     setMarkingSafe]      = useState(false);
  const [safeDone,        setSafeDone]         = useState(false);
  const [showResources,   setShowResources]    = useState(false);
  const [sosAlert,        setSOSAlert]         = useState(null);

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
        } catch { /* silent */ }
      },
      () => {},
      { timeout: 10000, maximumAge: 120000 }
    );
  }, [api]);

  // Socket: listen for SOS alerts & new incidents
  useEffect(() => {
    if (!socket) return;
    const onSOS = (payload) => {
      setSOSAlert(payload);
      setTimeout(() => setSOSAlert(null), 10000);
    };
    const onNew = (incident) => setNearbyIncidents(prev => [incident, ...prev].slice(0, 5));
    socket.on('sosAlert',    onSOS);
    socket.on('newIncident', onNew);
    return () => { socket.off('sosAlert', onSOS); socket.off('newIncident', onNew); };
  }, [socket]);

  const handleMarkSafe = async () => {
    setMarkingSafe(true);
    try {
      await api.patch('/users/safe');
      updateUser({ isSafe: true });
      setSafeDone(true);
    } catch { /* silent */ } finally {
      setMarkingSafe(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">

      {/* SOS Alert banner */}
      {sosAlert && (
        <div className="flex items-start gap-3 p-4 bg-red-950/80 border-2 border-red-600/60 rounded-2xl animate-pulse">
          <span className="text-2xl shrink-0">🚨</span>
          <div>
            <p className="text-sm font-bold text-red-300">SOS Alert Nearby</p>
            <p className="text-xs text-red-400/70 mt-0.5">{sosAlert.user?.name} has triggered an SOS emergency.</p>
          </div>
        </div>
      )}

      {/* Greeting */}
      <div>
        <h1 className="text-xl font-black text-zinc-100">
          Hi, {user?.name?.split(' ')[0]} 👋
        </h1>
        <p className="text-sm text-zinc-500 mt-0.5">Stay safe. Help is always nearby.</p>
      </div>

      {/* SOS + Mark Safe */}
      <div className="space-y-3">
        <SOSButton />

        {!user?.isSafe || safeDone ? (
          safeDone ? (
            <div className="flex items-center gap-2.5 p-3.5 bg-green-950/40 border border-green-700/40 rounded-xl">
              <CheckCircle className="w-4 h-4 text-green-400 shrink-0" />
              <p className="text-sm font-medium text-green-300">You're marked as safe</p>
            </div>
          ) : (
            <button
              onClick={handleMarkSafe}
              disabled={markingSafe}
              className="w-full flex items-center justify-center gap-2 py-3 bg-green-700/20 hover:bg-green-700/30 border border-green-600/40 rounded-xl text-green-400 text-sm font-semibold transition-all"
            >
              <CheckCircle className="w-4 h-4" />
              {markingSafe ? 'Marking…' : 'Mark Yourself Safe'}
            </button>
          )
        ) : (
          <div className="flex items-center gap-2.5 p-3.5 bg-green-950/30 border border-green-800/30 rounded-xl">
            <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
            <p className="text-sm text-green-400/70">You are marked as safe</p>
          </div>
        )}

        <button
          onClick={() => setShowResources(true)}
          className="w-full flex items-center justify-center gap-2 py-3 bg-orange-700/15 hover:bg-orange-700/25 border border-orange-600/30 rounded-xl text-orange-400 text-sm font-semibold transition-all"
        >
          <Package className="w-4 h-4" /> Request Food / Water / Medical Help
        </button>
      </div>

      {/* Weather */}
      <WeatherWidget />

      {/* Quick actions */}
      <div>
        <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">Quick Actions</p>
        <div className="grid grid-cols-2 gap-2.5">
          {QUICK_ACTIONS.map(({ to, icon: Icon, label, desc, color }) => (
            <Link
              key={to}
              to={to}
              className={`flex flex-col gap-2 p-4 bg-zinc-900 border rounded-2xl transition-all group ${color}`}
            >
              <Icon className="w-5 h-5 text-zinc-400 group-hover:text-zinc-200 transition" />
              <div>
                <p className="text-sm font-semibold text-zinc-200">{label}</p>
                <p className="text-xs text-zinc-500 mt-0.5">{desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Nearby incidents */}
      {nearbyIncidents.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Nearby Incidents</p>
            <span className="flex items-center gap-1 text-[10px] text-red-400">
              <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" /> LIVE
            </span>
          </div>

          <div className="space-y-2">
            {nearbyIncidents.map(inc => (
              <div key={inc._id} className="flex items-start gap-3 p-3.5 bg-zinc-900 border border-zinc-800 rounded-xl">
                <span className="text-xl shrink-0 mt-0.5">{TYPE_ICONS[inc.type] || '📍'}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-zinc-200 truncate">{inc.title}</p>
                    <span className={`shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${SEVERITY_COLORS[inc.severity]}`}>
                      {inc.severity?.toUpperCase()}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-500 mt-0.5 truncate flex items-center gap-1">
                    <MapPin className="w-2.5 h-2.5 shrink-0" />
                    {inc.location?.address || 'Nearby'}
                  </p>
                  {inc.aiTriage?.recommendedActions?.[0] && (
                    <p className="text-xs text-blue-400/80 mt-1 flex items-center gap-1">
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
        <div className="text-center py-8 text-zinc-600">
          <p className="text-2xl mb-2">🛡️</p>
          <p className="text-sm">No active incidents near you. Stay safe!</p>
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
