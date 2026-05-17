import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import LiveMap from '../components/LiveMap';
import {
  MapPin, Search, Filter, RefreshCw, Phone, Users, Wifi,
  Zap, Heart, Baby, Accessibility, BedDouble, Droplets,
  UtensilsCrossed, X, AlertTriangle, ChevronRight, Building2,
} from 'lucide-react';

// ── Constants ──────────────────────────────────────────────────────────────────

const TYPE_LABELS = {
  hospital:            { label: 'Hospital',       icon: '🏥', color: 'text-red-400 bg-red-500/10 border-red-500/30' },
  relief_camp:         { label: 'Relief Camp',    icon: '⛺', color: 'text-orange-400 bg-orange-500/10 border-orange-500/30' },
  school:              { label: 'School',         icon: '🏫', color: 'text-blue-400 bg-blue-500/10 border-blue-500/30' },
  community_hall:      { label: 'Comm. Hall',     icon: '🏛️', color: 'text-purple-400 bg-purple-500/10 border-purple-500/30' },
  government_building: { label: 'Govt Building',  icon: '🏢', color: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30' },
  warehouse:           { label: 'Warehouse',      icon: '🏭', color: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30' },
  other:               { label: 'Other',          icon: '📍', color: 'text-zinc-400 bg-zinc-500/10 border-zinc-500/30' },
};

const STATUS_STYLES = {
  active:    'bg-green-500/15 text-green-400 border-green-500/30',
  full:      'bg-red-500/15 text-red-400 border-red-500/30',
  preparing: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  closed:    'bg-zinc-500/15 text-zinc-400 border-zinc-500/30',
};

const AMENITY_ICONS = [
  { key: 'food',                icon: UtensilsCrossed, label: 'Food' },
  { key: 'water',               icon: Droplets,        label: 'Water' },
  { key: 'medical',             icon: Heart,           label: 'Medical' },
  { key: 'electricity',         icon: Zap,             label: 'Power' },
  { key: 'wifi',                icon: Wifi,            label: 'WiFi' },
  { key: 'bedding',             icon: BedDouble,       label: 'Beds' },
  { key: 'childCare',           icon: Baby,            label: 'Child Care' },
  { key: 'wheelchairAccessible',icon: Accessibility,   label: 'Accessible' },
];

// ── Sub-components ─────────────────────────────────────────────────────────────

const OccupancyBar = ({ current, total, status }) => {
  const pct = Math.min(100, total ? Math.round((current / total) * 100) : 0);
  const barColor = status === 'full' ? 'bg-red-500' : pct > 75 ? 'bg-orange-500' : pct > 50 ? 'bg-yellow-500' : 'bg-green-500';
  return (
    <div>
      <div className="flex justify-between text-xs text-zinc-400 mb-1">
        <span>{current.toLocaleString()} / {total.toLocaleString()} people</span>
        <span className="font-semibold">{pct}%</span>
      </div>
      <div className="h-1.5 bg-zinc-700 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
      <p className="text-xs mt-1 text-zinc-500">
        {status === 'full' ? '❌ No space available' : `✓ ${(total - current).toLocaleString()} spots free`}
      </p>
    </div>
  );
};

const ShelterCard = ({ shelter, isHighlit, onClick }) => {
  const typeInfo = TYPE_LABELS[shelter.type] || TYPE_LABELS.other;
  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-4 rounded-xl border transition-all duration-200 ${
        isHighlit
          ? 'border-blue-500/60 bg-blue-950/30 ring-1 ring-blue-500/30'
          : 'border-zinc-700/60 bg-zinc-900/60 hover:border-zinc-600 hover:bg-zinc-800/60'
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-start gap-2.5">
          <span className="text-2xl shrink-0 mt-0.5">{typeInfo.icon}</span>
          <div>
            <h3 className="text-sm font-semibold text-zinc-100 leading-tight">{shelter.name}</h3>
            <p className="text-xs text-zinc-500 mt-0.5 flex items-center gap-1">
              <MapPin className="w-3 h-3 shrink-0" />
              {shelter.location?.city}, {shelter.location?.state}
            </p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase ${STATUS_STYLES[shelter.status]}`}>
            {shelter.status}
          </span>
          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${typeInfo.color}`}>
            {typeInfo.label}
          </span>
        </div>
      </div>

      <OccupancyBar current={shelter.currentOccupancy} total={shelter.totalCapacity} status={shelter.status} />

      <div className="flex flex-wrap gap-1 mt-3">
        {AMENITY_ICONS.filter(a => shelter.amenities?.[a.key]).slice(0, 5).map(({ key, icon: Icon, label }) => (
          <span key={key} className="flex items-center gap-1 text-[10px] text-zinc-400 bg-zinc-800 border border-zinc-700 px-1.5 py-0.5 rounded-md">
            <Icon className="w-2.5 h-2.5" /> {label}
          </span>
        ))}
      </div>

      {shelter.distanceKm !== undefined && (
        <p className="text-xs text-blue-400 mt-2.5 flex items-center gap-1">
          <MapPin className="w-3 h-3" /> {shelter.distanceKm} km away
        </p>
      )}

      {shelter.contacts?.[0] && (
        <div className="mt-2.5 flex items-center justify-between">
          <div>
            <p className="text-xs text-zinc-400">{shelter.contacts[0].name}</p>
            <p className="text-[10px] text-zinc-600">{shelter.contacts[0].role}</p>
          </div>
          <a href={`tel:${shelter.contacts[0].phone}`} onClick={e => e.stopPropagation()}
            className="flex items-center gap-1 text-xs text-green-400 hover:text-green-300 bg-green-500/10 hover:bg-green-500/20 border border-green-500/30 px-2 py-1 rounded-lg transition">
            <Phone className="w-3 h-3" /> Call
          </a>
        </div>
      )}

      {isHighlit && (
        <div className="mt-2 pt-2 border-t border-zinc-700/50 flex items-center justify-between text-xs text-blue-400">
          <span>Showing on map</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </div>
      )}
    </button>
  );
};

const PlaceCard = ({ place, isHighlit, onClick }) => (
  <button
    onClick={onClick}
    className={`w-full text-left p-4 rounded-xl border transition-all duration-200 ${
      isHighlit
        ? 'border-green-500/60 bg-green-950/20 ring-1 ring-green-500/30'
        : 'border-zinc-700/60 bg-zinc-900/60 hover:border-zinc-600 hover:bg-zinc-800/60'
    }`}
  >
    <div className="flex items-start gap-2.5">
      <span className="text-2xl shrink-0">🗺️</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-semibold text-zinc-100 leading-tight">{place.name}</h3>
          <span className="shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full border text-green-400 bg-green-500/10 border-green-500/30">
            Google
          </span>
        </div>
        <p className="text-xs text-zinc-500 mt-0.5 flex items-center gap-1">
          <MapPin className="w-3 h-3 shrink-0" /> {place.vicinity || place.formatted_address}
        </p>
        {place.rating && (
          <p className="text-xs text-yellow-400 mt-1">⭐ {place.rating} ({place.user_ratings_total || 0} reviews)</p>
        )}
        <div className="flex gap-1 mt-2 flex-wrap">
          {place.types?.slice(0, 3).map(t => (
            <span key={t} className="text-[10px] text-zinc-500 bg-zinc-800 border border-zinc-700 px-1.5 py-0.5 rounded-md">
              {t.replace('_', ' ')}
            </span>
          ))}
        </div>
        {place.opening_hours?.open_now !== undefined && (
          <p className={`text-xs mt-1.5 font-semibold ${place.opening_hours.open_now ? 'text-green-400' : 'text-red-400'}`}>
            {place.opening_hours.open_now ? '✓ Open now' : '✗ Closed'}
          </p>
        )}
      </div>
    </div>
  </button>
);

// ── Main page ──────────────────────────────────────────────────────────────────
const Shelters = () => {
  const { api } = useAuth();

  // DB shelters state
  const [shelters,       setShelters]       = useState([]);
  const [loading,        setLoading]        = useState(true);
  const [error,          setError]          = useState(null);
  const [highlighted,    setHighlighted]    = useState(null);
  const [userLocation,   setUserLocation]   = useState(null);
  const [locLoading,     setLocLoading]     = useState(false);
  const [searchNearby,   setSearchNearby]   = useState(false);
  const [radius,         setRadius]         = useState(50);
  const [appliedRadius,  setAppliedRadius]  = useState(50);
  const [filterType,     setFilterType]     = useState('all');
  const [filterStatus,   setFilterStatus]   = useState('active');
  const [filterAmenity,  setFilterAmenity]  = useState('');
  const [searchQuery,    setSearchQuery]    = useState('');
  const [showFilters,    setShowFilters]    = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Google Places state
  const [tab,            setTab]            = useState('registered'); // 'registered' | 'nearby'
  const [places,         setPlaces]         = useState([]);
  const [placesLoading,  setPlacesLoading]  = useState(false);
  const [placesError,    setPlacesError]    = useState(null);
  const [placeType,      setPlaceType]      = useState('hospital');

  const cardRefs = useRef({});

  // ── DB shelters fetch ──────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    const doFetch = async () => {
      setLoading(true);
      setError(null);
      try {
        let result;
        if (searchNearby && userLocation) {
          const params = new URLSearchParams({
            lng: userLocation.lng, lat: userLocation.lat,
            maxDistance: appliedRadius * 1000,
          });
          if (filterType !== 'all') params.append('type', filterType);
          const { data } = await api.get(`/shelters/nearby?${params}`);
          result = data.shelters || [];
        } else {
          const params = new URLSearchParams();
          if (filterStatus !== 'all') params.append('status', filterStatus);
          if (filterType   !== 'all') params.append('type',   filterType);
          const { data } = await api.get(`/shelters?${params}`);
          result = data.shelters || [];
        }
        if (!cancelled) setShelters(result);
      } catch (err) {
        if (!cancelled) setError(err.response?.data?.message || 'Failed to load shelters');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    doFetch();
    return () => { cancelled = true; };
  }, [api, searchNearby, userLocation, filterStatus, filterType, appliedRadius, refreshTrigger]);

  // ── Google Places fetch ────────────────────────────────────────────────────
  const fetchPlaces = useCallback(async (loc) => {
    if (!loc) return;
    setPlacesLoading(true);
    setPlacesError(null);
    try {
      const { data } = await api.get(`/shelters/places?lat=${loc.lat}&lng=${loc.lng}&type=${placeType}&radius=${appliedRadius * 1000}`);
      setPlaces(data.places || []);
    } catch (err) {
      setPlacesError(err.response?.data?.message || 'Failed to load nearby places');
    } finally {
      setPlacesLoading(false);
    }
  }, [api, placeType, appliedRadius]);

  useEffect(() => {
    if (tab === 'nearby' && userLocation) fetchPlaces(userLocation);
  }, [tab, userLocation, fetchPlaces]);

  // ── Geolocation ────────────────────────────────────────────────────────────
  const handleLocate = () => {
    if (!navigator.geolocation) { setError('Geolocation not supported'); return; }
    setLocLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserLocation(coords);
        setSearchNearby(true);
        setLocLoading(false);
      },
      (err) => {
        const msg = err.code === 1 ? 'Location permission denied' :
                    err.code === 3 ? 'Location request timed out' : 'Could not get location';
        setError(msg);
        setLocLoading(false);
      },
      { timeout: 10000, maximumAge: 60000, enableHighAccuracy: false }
    );
  };

  const handleClearLocation = () => { setUserLocation(null); setSearchNearby(false); };

  useEffect(() => {
    if (!highlighted) return;
    const el = cardRefs.current[highlighted];
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [highlighted]);

  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setError(null), 5000);
    return () => clearTimeout(t);
  }, [error]);

  // ── Derived ────────────────────────────────────────────────────────────────
  const filtered = shelters.filter(s => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!s.name.toLowerCase().includes(q) && !s.location?.city?.toLowerCase().includes(q) && !s.location?.address?.toLowerCase().includes(q)) return false;
    }
    if (filterAmenity && !s.amenities?.[filterAmenity]) return false;
    return true;
  });

  const activeCount   = shelters.filter(s => s.status === 'active').length;
  const totalSpots    = shelters.reduce((a, s) => a + Math.max(0, (s.totalCapacity || 0) - (s.currentOccupancy || 0)), 0);

  return (
    <div className="flex h-[calc(100vh-56px)] overflow-hidden">

      {/* ── Sidebar ─────────────────────────────────────────────────────────── */}
      <aside className="w-80 xl:w-96 bg-zinc-900 border-r border-zinc-800 flex flex-col overflow-hidden shrink-0">

        {/* Controls */}
        <div className="px-4 pt-4 pb-3 border-b border-zinc-800 space-y-3 shrink-0">
          {/* Stats row */}
          <div className="flex gap-2">
            <div className="flex-1 flex items-center gap-1.5 px-2.5 py-1.5 bg-zinc-800 rounded-lg text-xs">
              <span className="w-2 h-2 bg-green-400 rounded-full" />
              <span className="text-zinc-300 font-medium">{activeCount} active</span>
            </div>
            <div className="flex-1 flex items-center gap-1.5 px-2.5 py-1.5 bg-zinc-800 rounded-lg text-xs">
              <Users className="w-3 h-3 text-zinc-400" />
              <span className="text-zinc-300 font-medium">{totalSpots.toLocaleString()} spots</span>
            </div>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
            <input
              type="text"
              placeholder="Search shelters, city…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-blue-500 transition"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2">
                <X className="w-4 h-4 text-zinc-500 hover:text-zinc-300" />
              </button>
            )}
          </div>

          {/* Nearby / location row */}
          <div className="flex gap-2">
            {!searchNearby ? (
              <button onClick={handleLocate} disabled={locLoading}
                className="flex-1 flex items-center justify-center gap-2 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-lg text-sm font-semibold transition">
                {locLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <MapPin className="w-4 h-4" />}
                {locLoading ? 'Locating…' : 'Find Near Me'}
              </button>
            ) : (
              <div className="flex-1 flex items-center justify-between py-2 px-3 bg-blue-950/40 border border-blue-800/40 rounded-lg">
                <span className="text-xs text-blue-300 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5" /> Showing nearby ({radius} km)
                </span>
                <button onClick={handleClearLocation}><X className="w-4 h-4 text-blue-400 hover:text-blue-200" /></button>
              </div>
            )}

            <button onClick={() => setShowFilters(f => !f)}
              className={`px-3 py-2 rounded-lg border text-sm transition ${showFilters ? 'bg-zinc-700 border-zinc-600' : 'bg-zinc-800 border-zinc-700 hover:bg-zinc-700'}`}>
              <Filter className="w-4 h-4" />
            </button>

            <button onClick={() => setRefreshTrigger(t => t + 1)}
              className="px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 hover:bg-zinc-700 transition">
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          {searchNearby && (
            <div>
              <label className="text-xs text-zinc-400 mb-1 block">Radius: <span className="text-white font-semibold">{radius} km</span></label>
              <input type="range" min={5} max={200} step={5} value={radius}
                onChange={e => setRadius(Number(e.target.value))}
                onMouseUp={() => setAppliedRadius(radius)}
                onPointerUp={() => setAppliedRadius(radius)}
                onTouchEnd={() => setAppliedRadius(radius)}
                className="w-full accent-blue-500 h-1.5" />
            </div>
          )}

          {showFilters && (
            <div className="space-y-3 pt-1">
              <div>
                <label className="text-xs text-zinc-500 mb-1.5 block font-medium">Status</label>
                <div className="flex flex-wrap gap-1.5">
                  {['all','active','full','preparing','closed'].map(s => (
                    <button key={s} onClick={() => setFilterStatus(s)}
                      className={`text-xs px-2.5 py-1 rounded-full border font-medium transition capitalize ${filterStatus === s ? 'bg-blue-600 border-blue-500 text-white' : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-500'}`}>
                      {s === 'all' ? 'All' : s}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs text-zinc-500 mb-1.5 block font-medium">Type</label>
                <div className="flex flex-wrap gap-1.5">
                  {[['all','All'],['hospital','Hospital'],['relief_camp','Relief Camp'],['school','School'],['community_hall','Comm. Hall'],['government_building','Govt. Bldg']].map(([v,l]) => (
                    <button key={v} onClick={() => setFilterType(v)}
                      className={`text-xs px-2.5 py-1 rounded-full border font-medium transition ${filterType === v ? 'bg-blue-600 border-blue-500 text-white' : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-500'}`}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs text-zinc-500 mb-1.5 block font-medium">Must have</label>
                <div className="flex flex-wrap gap-1.5">
                  {[['','Any'],['food','Food'],['water','Water'],['medical','Medical'],['electricity','Power'],['wifi','WiFi'],['bedding','Beds'],['childCare','Child Care'],['wheelchairAccessible','Accessible']].map(([v,l]) => (
                    <button key={v} onClick={() => setFilterAmenity(v)}
                      className={`text-xs px-2.5 py-1 rounded-full border font-medium transition ${filterAmenity === v ? 'bg-blue-600 border-blue-500 text-white' : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-500'}`}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex border-b border-zinc-800 shrink-0">
          <button
            onClick={() => setTab('registered')}
            className={`flex-1 py-2.5 text-xs font-semibold flex items-center justify-center gap-1.5 transition ${tab === 'registered' ? 'text-blue-400 border-b-2 border-blue-500' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            <Building2 className="w-3.5 h-3.5" /> Registered ({filtered.length})
          </button>
          <button
            onClick={() => { setTab('nearby'); if (userLocation) fetchPlaces(userLocation); else handleLocate(); }}
            className={`flex-1 py-2.5 text-xs font-semibold flex items-center justify-center gap-1.5 transition ${tab === 'nearby' ? 'text-green-400 border-b-2 border-green-500' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            🗺️ Google Places {places.length > 0 && `(${places.length})`}
          </button>
        </div>

        {/* List area */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-950/30 border border-red-900/40 rounded-xl text-sm text-red-400">
              <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
            </div>
          )}

          {tab === 'registered' && (
            loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/40 animate-pulse space-y-3">
                  <div className="h-4 bg-zinc-800 rounded w-3/4" />
                  <div className="h-3 bg-zinc-800 rounded w-1/2" />
                  <div className="h-2 bg-zinc-800 rounded-full" />
                </div>
              ))
            ) : filtered.length === 0 ? (
              <div className="text-center py-12 text-zinc-500">
                <p className="text-3xl mb-3">🏕️</p>
                <p className="text-sm font-medium">No shelters found</p>
                <p className="text-xs mt-1">Try adjusting filters or increasing radius</p>
              </div>
            ) : (
              filtered.map(shelter => (
                <div key={shelter._id} ref={el => cardRefs.current[shelter._id] = el}>
                  <ShelterCard
                    shelter={shelter}
                    isHighlit={highlighted === shelter._id}
                    onClick={() => setHighlighted(prev => prev === shelter._id ? null : shelter._id)}
                  />
                </div>
              ))
            )
          )}

          {tab === 'nearby' && (
            <>
              {/* Place type selector */}
              <div className="flex gap-1.5 flex-wrap pb-1">
                {[['hospital','🏥 Hospitals'],['pharmacy','💊 Pharmacy'],['police','👮 Police'],['fire_station','🚒 Fire Stn']].map(([v,l]) => (
                  <button key={v} onClick={() => setPlaceType(v)}
                    className={`text-xs px-2.5 py-1 rounded-full border font-medium transition ${placeType === v ? 'bg-blue-600 border-blue-500 text-white' : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-500'}`}>
                    {l}
                  </button>
                ))}
              </div>

              {!userLocation ? (
                <div className="text-center py-12 text-zinc-500">
                  <MapPin className="w-8 h-8 mx-auto mb-3 opacity-30" />
                  <p className="text-sm font-medium">Location required</p>
                  <p className="text-xs mt-1">Click "Find Near Me" to search Google Places</p>
                </div>
              ) : placesLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/40 animate-pulse space-y-3">
                    <div className="h-4 bg-zinc-800 rounded w-3/4" />
                    <div className="h-3 bg-zinc-800 rounded w-1/2" />
                  </div>
                ))
              ) : placesError ? (
                <div className="flex items-center gap-2 p-3 bg-red-950/30 border border-red-900/40 rounded-xl text-sm text-red-400">
                  <AlertTriangle className="w-4 h-4 shrink-0" /> {placesError}
                </div>
              ) : places.length === 0 ? (
                <div className="text-center py-12 text-zinc-500">
                  <p className="text-3xl mb-3">🔍</p>
                  <p className="text-sm font-medium">No places found</p>
                  <p className="text-xs mt-1">Try a different type or larger radius</p>
                </div>
              ) : (
                places.map(place => (
                  <div key={place.place_id} ref={el => cardRefs.current[place.place_id] = el}>
                    <PlaceCard
                      place={place}
                      isHighlit={highlighted === place.place_id}
                      onClick={() => setHighlighted(prev => prev === place.place_id ? null : place.place_id)}
                    />
                  </div>
                ))
              )}
            </>
          )}
        </div>
      </aside>

      {/* ── Map ─────────────────────────────────────────────────────────────── */}
      <div className="flex-1 relative">
        <LiveMap
          incidents={[]}
          shelters={tab === 'registered' ? filtered : []}
          showShelters={tab === 'registered'}
          highlightShelterId={highlighted}
        />

        {/* Legend overlay */}
        <div className="absolute bottom-6 left-4 bg-zinc-900/90 backdrop-blur-sm border border-zinc-700 rounded-xl p-3 text-xs space-y-1.5 z-10">
          <p className="text-zinc-400 font-semibold uppercase tracking-wider text-[10px] mb-2">Shelter Status</p>
          {[['Active','#22c55e'],['Full','#f97316'],['Preparing','#3b82f6'],['Closed','#6b7280']].map(([label, color]) => (
            <div key={label} className="flex items-center gap-2">
              <span style={{
                display: 'inline-block', width: 0, height: 0,
                borderLeft: '6px solid transparent', borderRight: '6px solid transparent',
                borderBottom: `11px solid ${color}`, flexShrink: 0,
              }} />
              <span className="text-zinc-300">{label}</span>
            </div>
          ))}
        </div>

        {/* Active count badge */}
        <div className="absolute top-4 left-4 flex items-center gap-2 px-3 py-1.5 bg-zinc-900/90 backdrop-blur-sm rounded-full border border-zinc-700 text-xs font-medium z-10">
          <span className="w-2 h-2 bg-green-500 rounded-full" />
          {tab === 'registered' ? `${filtered.length} registered` : `${places.length} places`} on map
        </div>
      </div>
    </div>
  );
};

export default Shelters;
