import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import {
  Building2, Users, MapPin, Phone, Wifi, Zap, Utensils, Droplets,
  HeartPulse, BedDouble, Baby, Accessibility, PawPrint, Toilet,
  RefreshCw, AlertTriangle, CheckCircle, ChevronDown,
  Edit2, Save, X, Plus, Minus, Shield, Info, Hash,
} from 'lucide-react';
import { SHELTER_TYPE_META, SHELTER_STATUS_BADGE } from '../../constants/shelter';

// ── Amenity config ─────────────────────────────────────────────────────────────
const AMENITIES_CONFIG = [
  { key: 'food',               icon: Utensils,      label: 'Food'        },
  { key: 'water',              icon: Droplets,      label: 'Water'       },
  { key: 'medical',            icon: HeartPulse,    label: 'Medical'     },
  { key: 'electricity',        icon: Zap,           label: 'Electricity' },
  { key: 'wifi',               icon: Wifi,          label: 'WiFi'        },
  { key: 'toilets',            icon: Toilet,        label: 'Toilets'     },
  { key: 'bedding',            icon: BedDouble,     label: 'Bedding'     },
  { key: 'childCare',          icon: Baby,          label: 'Child Care'  },
  { key: 'petFriendly',        icon: PawPrint,      label: 'Pet Friendly'},
  { key: 'wheelchairAccessible',icon: Accessibility, label: 'Wheelchair'  },
];

const STATUS_OPTIONS = [
  { value: 'active',    label: 'Active',    color: 'text-green-400 bg-green-500/10 border-green-500/30' },
  { value: 'full',      label: 'Full',      color: 'text-red-400 bg-red-500/10 border-red-500/30'      },
  { value: 'preparing', label: 'Preparing', color: 'text-blue-400 bg-blue-500/10 border-blue-500/30'   },
  { value: 'closed',    label: 'Closed',    color: 'text-zinc-400 bg-zinc-700/40 border-zinc-600/30'   },
];

// ── Occupancy bar ──────────────────────────────────────────────────────────────
const OccupancyBar = ({ current, total, status }) => {
  const pct   = total ? Math.min(100, Math.round((current / total) * 100)) : 0;
  const color = status === 'full' || pct >= 100 ? 'bg-red-500'
              : pct >= 80  ? 'bg-orange-500'
              : pct >= 60  ? 'bg-yellow-500'
              : 'bg-green-500';
  return (
    <div>
      <div className="flex items-center justify-between text-xs text-zinc-400 mb-1.5">
        <span>{current} / {total} people</span>
        <span className="font-bold">{pct}% full</span>
      </div>
      <div className="h-3 bg-zinc-700/60 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${color} transition-all duration-700`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-xs text-zinc-500 mt-1">
        {Math.max(0, total - current)} spots available
      </p>
    </div>
  );
};

// ── Main component ─────────────────────────────────────────────────────────────
const ShelterManagerPanel = () => {
  const { api }  = useAuth();
  const socket   = useSocket();

  const [shelter,     setShelter]     = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState(null);
  const [success,     setSuccess]     = useState('');

  // Quick occupancy controls
  const [occDelta,    setOccDelta]    = useState('');
  const [occLoading,  setOccLoading]  = useState(false);
  const [occError,    setOccError]    = useState('');

  // Status panel
  const [statusOpen,  setStatusOpen]  = useState(false);
  const [statusLoading,setStatusLoading]=useState(false);

  // Amenity editing
  const [editAmenities, setEditAmenities] = useState(false);
  const [amenities,     setAmenities]     = useState({});
  const [amenSaving,    setAmenSaving]    = useState(false);

  // Notes editing
  const [editNotes, setEditNotes]   = useState(false);
  const [notes,     setNotes]       = useState('');
  const [notesSaving,setNotesSaving]= useState(false);

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchShelter = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get('/shelters/mine');
      setShelter(data.shelter || null);
      if (data.shelter) {
        setAmenities(data.shelter.amenities || {});
        setNotes(data.shelter.description || '');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load your shelter');
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => { fetchShelter(); }, [fetchShelter]);

  // ── Real-time occupancy / status updates ───────────────────────────────────
  useEffect(() => {
    if (!socket || !shelter) return;
    const handler = (payload) => {
      if (payload.shelterId?.toString() !== shelter._id?.toString()) return;
      setShelter(prev => ({
        ...prev,
        currentOccupancy: payload.currentOccupancy ?? prev.currentOccupancy,
        status:           payload.status           ?? prev.status,
      }));
    };
    socket.on('shelterUpdated',          handler);
    socket.on('shelterOccupancyUpdated', handler);
    return () => {
      socket.off('shelterUpdated',          handler);
      socket.off('shelterOccupancyUpdated', handler);
    };
  }, [socket, shelter]);

  const showSuccess = (msg) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(''), 3500);
  };

  // ── Occupancy update ───────────────────────────────────────────────────────
  const applyDelta = async (delta) => {
    if (!shelter) return;
    setOccLoading(true);
    setOccError('');
    try {
      const { data } = await api.patch(`/shelters/${shelter._id}/occupancy`, { delta });
      setShelter(data.shelter);
      showSuccess(`Occupancy updated to ${data.shelter.currentOccupancy}`);
      setOccDelta('');
    } catch (err) {
      setOccError(err.response?.data?.message || 'Failed to update occupancy');
    } finally {
      setOccLoading(false);
    }
  };

  const applyCustomDelta = () => {
    const d = parseInt(occDelta);
    if (!isNaN(d) && d !== 0) applyDelta(d);
  };

  // ── Status change ──────────────────────────────────────────────────────────
  const changeStatus = async (newStatus) => {
    if (!shelter || newStatus === shelter.status) { setStatusOpen(false); return; }
    setStatusLoading(true);
    try {
      const { data } = await api.patch(`/shelters/${shelter._id}/status`, { status: newStatus });
      setShelter(data.shelter);
      setStatusOpen(false);
      showSuccess(`Status changed to ${newStatus}`);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to change status');
    } finally {
      setStatusLoading(false);
    }
  };

  // ── Amenities save ─────────────────────────────────────────────────────────
  const saveAmenities = async () => {
    if (!shelter) return;
    setAmenSaving(true);
    try {
      const { data } = await api.put(`/shelters/${shelter._id}`, { amenities });
      setShelter(data.shelter);
      setEditAmenities(false);
      showSuccess('Amenities updated');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update amenities');
    } finally {
      setAmenSaving(false);
    }
  };

  // ── Notes save ─────────────────────────────────────────────────────────────
  const saveNotes = async () => {
    if (!shelter) return;
    setNotesSaving(true);
    try {
      const { data } = await api.put(`/shelters/${shelter._id}`, { description: notes });
      setShelter(data.shelter);
      setEditNotes(false);
      showSuccess('Notes updated');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update notes');
    } finally {
      setNotesSaving(false);
    }
  };

  // ── Loading skeleton ───────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-32 bg-zinc-900 border border-zinc-800 rounded-2xl animate-pulse" />
        ))}
      </div>
    );
  }

  // ── No shelter assigned ────────────────────────────────────────────────────
  if (!shelter && !error) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
        <div className="w-20 h-20 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-5">
          <Building2 className="w-10 h-10 text-zinc-600" />
        </div>
        <h2 className="text-lg font-black text-zinc-200 mb-2">No Shelter Assigned</h2>
        <p className="text-sm text-zinc-500 max-w-xs leading-relaxed">
          You have not been assigned to manage any shelter yet. Please ask an admin to create a shelter and set you as the manager.
        </p>
        <button
          onClick={fetchShelter}
          className="mt-5 flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-xl text-xs font-semibold text-zinc-300 transition"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Check Again
        </button>
      </div>
    );
  }

  // ── Error state ────────────────────────────────────────────────────────────
  if (error && !shelter) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="flex items-center gap-3 p-4 bg-red-950/40 border border-red-800/40 rounded-xl text-red-400 text-sm max-w-sm">
          <AlertTriangle className="w-5 h-5 shrink-0" /> {error}
          <button onClick={fetchShelter} className="ml-auto text-xs underline">Retry</button>
        </div>
      </div>
    );
  }

  const pct = shelter.totalCapacity
    ? Math.min(100, Math.round((shelter.currentOccupancy / shelter.totalCapacity) * 100))
    : 0;

  const currentStatusMeta = STATUS_OPTIONS.find(s => s.value === shelter.status);

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-5">

      {/* Flash messages */}
      {success && (
        <div className="flex items-center gap-2.5 p-3.5 bg-green-950/40 border border-green-700/40 rounded-xl text-green-400 text-sm">
          <CheckCircle className="w-4 h-4 shrink-0" /> {success}
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2.5 p-3.5 bg-red-950/40 border border-red-800/40 rounded-xl text-red-400 text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
          <button onClick={() => setError(null)} className="ml-auto"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black text-zinc-100">My Shelter</h1>
          <p className="text-xs text-zinc-500 mt-0.5">Manage occupancy, status and amenities</p>
        </div>
        <button
          onClick={fetchShelter}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg text-xs font-medium text-zinc-300 transition"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      {/* ── Shelter identity card ──────────────────────────────────────────── */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
        {/* Coloured top strip */}
        <div className={`h-1 w-full ${
          shelter.status === 'active'   ? 'bg-green-500' :
          shelter.status === 'full'     ? 'bg-red-500'   :
          shelter.status === 'preparing'? 'bg-blue-500'  :
          'bg-zinc-600'
        }`} />

        <div className="p-5">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-600/10 border border-blue-600/20 flex items-center justify-center shrink-0 text-2xl">
              {SHELTER_TYPE_META?.[shelter.type]?.icon || '🏠'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <h2 className="text-base font-black text-zinc-100 leading-tight">{shelter.name}</h2>
                <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase ${SHELTER_STATUS_BADGE?.[shelter.status] || 'text-zinc-400 border-zinc-600'}`}>
                  {shelter.status}
                </span>
              </div>
              <p className="text-xs text-zinc-500 mt-1 flex items-center gap-1">
                <MapPin className="w-3 h-3 shrink-0" />
                {shelter.location?.address}
                {shelter.location?.city && `, ${shelter.location.city}`}
              </p>
              <p className="text-[10px] text-zinc-600 mt-0.5 capitalize">
                {shelter.type?.replace('_', ' ')} · ID: {shelter._id?.toString().slice(-8)}
              </p>
            </div>
          </div>

          {/* Contact */}
          {shelter.contacts?.[0]?.phone && (
            <div className="flex items-center gap-2 mt-4 pt-4 border-t border-zinc-800">
              <Phone className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
              <span className="text-xs text-zinc-400">{shelter.contacts[0].name} ({shelter.contacts[0].role})</span>
              <a
                href={`tel:${shelter.contacts[0].phone}`}
                className="ml-auto text-xs text-green-400 bg-green-500/10 border border-green-500/20 px-2 py-0.5 rounded-lg hover:bg-green-500/20 transition"
              >
                {shelter.contacts[0].phone}
              </a>
            </div>
          )}
        </div>
      </div>

      {/* ── Status switcher ────────────────────────────────────────────────── */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-zinc-400" />
            <p className="text-sm font-semibold text-zinc-200">Shelter Status</p>
          </div>
          <button
            onClick={() => setStatusOpen(o => !o)}
            disabled={statusLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg text-xs font-semibold text-zinc-300 transition"
          >
            {statusLoading ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Edit2 className="w-3 h-3" />}
            Change
            <ChevronDown className={`w-3 h-3 transition-transform ${statusOpen ? 'rotate-180' : ''}`} />
          </button>
        </div>

        <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border ${currentStatusMeta?.color || ''}`}>
          <div className="w-2 h-2 rounded-full bg-current opacity-80 animate-pulse" />
          <span className="text-sm font-bold capitalize">{shelter.status}</span>
        </div>

        {statusOpen && (
          <div className="mt-3 grid grid-cols-2 gap-2">
            {STATUS_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => changeStatus(opt.value)}
                disabled={opt.value === shelter.status || statusLoading}
                className={`px-3 py-2.5 rounded-xl border text-sm font-semibold transition ${
                  opt.value === shelter.status
                    ? opt.color + ' opacity-50 cursor-default'
                    : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200'
                }`}
              >
                {opt.label}
                {opt.value === shelter.status && ' ✓'}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Occupancy panel ────────────────────────────────────────────────── */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-blue-400" />
          <p className="text-sm font-semibold text-zinc-200">Occupancy Control</p>
          <span className="ml-auto text-xs font-bold text-zinc-300 bg-zinc-800 border border-zinc-700 px-2 py-0.5 rounded-full">
            {pct}%
          </span>
        </div>

        <OccupancyBar
          current={shelter.currentOccupancy || 0}
          total={shelter.totalCapacity || 0}
          status={shelter.status}
        />

        {/* Quick ± buttons */}
        <div className="flex items-center gap-2">
          {[-20, -10, -5, -1].map(d => (
            <button
              key={d}
              onClick={() => applyDelta(d)}
              disabled={occLoading || (shelter.currentOccupancy || 0) === 0}
              className="flex-1 py-2 bg-red-950/30 hover:bg-red-950/50 border border-red-800/30 rounded-lg text-xs font-bold text-red-400 transition disabled:opacity-40"
            >
              {d}
            </button>
          ))}
          <div className="w-px h-6 bg-zinc-700" />
          {[1, 5, 10, 20].map(d => (
            <button
              key={d}
              onClick={() => applyDelta(d)}
              disabled={occLoading || (shelter.currentOccupancy || 0) >= (shelter.totalCapacity || 0)}
              className="flex-1 py-2 bg-green-950/30 hover:bg-green-950/50 border border-green-800/30 rounded-lg text-xs font-bold text-green-400 transition disabled:opacity-40"
            >
              +{d}
            </button>
          ))}
        </div>

        {/* Custom delta input */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
            <input
              type="number"
              value={occDelta}
              onChange={e => setOccDelta(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && applyCustomDelta()}
              placeholder="Custom delta (e.g. -30 or +50)"
              className="w-full pl-9 pr-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-blue-500 transition"
            />
          </div>
          <button
            onClick={applyCustomDelta}
            disabled={occLoading || !occDelta}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg text-sm font-semibold transition"
          >
            {occLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Apply'}
          </button>
        </div>

        {occError && (
          <p className="text-xs text-red-400 flex items-center gap-1.5">
            <AlertTriangle className="w-3 h-3 shrink-0" /> {occError}
          </p>
        )}
      </div>

      {/* ── Live stats row ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total Capacity',    value: shelter.totalCapacity || 0,   color: 'text-zinc-100' },
          { label: 'Current Occupancy', value: shelter.currentOccupancy || 0, color: pct >= 90 ? 'text-red-400' : pct >= 70 ? 'text-orange-400' : 'text-green-400' },
          { label: 'Available Spots',   value: Math.max(0, (shelter.totalCapacity || 0) - (shelter.currentOccupancy || 0)), color: 'text-blue-400' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-center">
            <p className={`text-2xl font-black ${color}`}>{value}</p>
            <p className="text-[10px] text-zinc-500 mt-0.5 leading-tight">{label}</p>
          </div>
        ))}
      </div>

      {/* ── Amenities editor ───────────────────────────────────────────────── */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-zinc-400" />
            <p className="text-sm font-semibold text-zinc-200">Amenities</p>
          </div>
          {editAmenities ? (
            <div className="flex gap-2">
              <button
                onClick={() => { setEditAmenities(false); setAmenities(shelter.amenities || {}); }}
                className="flex items-center gap-1 px-2.5 py-1 bg-zinc-800 border border-zinc-700 rounded-lg text-xs text-zinc-400 hover:text-zinc-200 transition"
              >
                <X className="w-3 h-3" /> Cancel
              </button>
              <button
                onClick={saveAmenities}
                disabled={amenSaving}
                className="flex items-center gap-1 px-2.5 py-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-lg text-xs text-white font-semibold transition"
              >
                {amenSaving ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                Save
              </button>
            </div>
          ) : (
            <button
              onClick={() => setEditAmenities(true)}
              className="flex items-center gap-1 px-2.5 py-1 bg-zinc-800 border border-zinc-700 rounded-lg text-xs text-zinc-400 hover:text-zinc-200 transition"
            >
              <Edit2 className="w-3 h-3" /> Edit
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {AMENITIES_CONFIG.map(({ key, icon: Icon, label }) => {
            const active = editAmenities ? amenities[key] : shelter.amenities?.[key];
            return (
              <button
                key={key}
                type="button"
                disabled={!editAmenities}
                onClick={() => editAmenities && setAmenities(prev => ({ ...prev, [key]: !prev[key] }))}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition ${
                  active
                    ? 'bg-blue-600/15 border-blue-600/40 text-blue-300'
                    : 'bg-zinc-800 border-zinc-700 text-zinc-600'
                } ${editAmenities && !active ? 'hover:border-zinc-500 hover:text-zinc-400 cursor-pointer' : ''}
                ${editAmenities && active ? 'cursor-pointer' : ''}
                ${!editAmenities ? 'cursor-default' : ''}`}
              >
                <Icon className="w-3 h-3" /> {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Notes / Description ────────────────────────────────────────────── */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-zinc-200">Shelter Notes</p>
          {editNotes ? (
            <div className="flex gap-2">
              <button
                onClick={() => { setEditNotes(false); setNotes(shelter.description || ''); }}
                className="flex items-center gap-1 px-2.5 py-1 bg-zinc-800 border border-zinc-700 rounded-lg text-xs text-zinc-400 hover:text-zinc-200 transition"
              >
                <X className="w-3 h-3" /> Cancel
              </button>
              <button
                onClick={saveNotes}
                disabled={notesSaving}
                className="flex items-center gap-1 px-2.5 py-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-lg text-xs text-white font-semibold transition"
              >
                {notesSaving ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                Save
              </button>
            </div>
          ) : (
            <button
              onClick={() => setEditNotes(true)}
              className="flex items-center gap-1 px-2.5 py-1 bg-zinc-800 border border-zinc-700 rounded-lg text-xs text-zinc-400 hover:text-zinc-200 transition"
            >
              <Edit2 className="w-3 h-3" /> Edit
            </button>
          )}
        </div>

        {editNotes ? (
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={4}
            placeholder="Enter notes for this shelter (current situation, special instructions, resource shortages…)"
            className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-xl text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-blue-500 transition resize-none"
          />
        ) : (
          <p className="text-sm text-zinc-400 leading-relaxed">
            {shelter.description || <span className="text-zinc-600 italic">No notes added. Click Edit to add operational notes.</span>}
          </p>
        )}
      </div>

      {/* ── Recent occupants ───────────────────────────────────────────────── */}
      {shelter.registeredOccupants?.length > 0 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-zinc-400" />
            <p className="text-sm font-semibold text-zinc-200">
              Registered Occupants
              <span className="ml-2 text-xs font-normal text-zinc-500">({shelter.registeredOccupants.length})</span>
            </p>
          </div>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {shelter.registeredOccupants.map((occ, i) => (
              <div key={occ._id || i} className="flex items-center gap-2.5 p-2 bg-zinc-800/50 border border-zinc-700/50 rounded-lg">
                <div className="w-7 h-7 rounded-full bg-blue-600/20 border border-blue-600/30 flex items-center justify-center text-xs font-bold text-blue-400 shrink-0">
                  {(occ.name || '?')[0]?.toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-zinc-200 truncate">{occ.name || '—'}</p>
                  <p className="text-[10px] text-zinc-500 truncate">{occ.email || '—'}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ShelterManagerPanel;
