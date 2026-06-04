import { useState, useCallback, useRef, useEffect } from 'react';
import { GoogleMap, useJsApiLoader, Marker, InfoWindow, Circle } from '@react-google-maps/api';
import { MapPin, AlertTriangle } from 'lucide-react';

const containerStyle = { width: '100%', height: '100%' };
const defaultCenter  = { lat: 20.5937, lng: 78.9629 };

import { TYPE_ICONS, SEVERITY_HEX } from '../constants/incident';
import { SHELTER_TYPE_META, SHELTER_STATUS_HEX } from '../constants/shelter';

const PULSE_RADII = [3000, 6000, 9000];

// ── Dark map theme (matches the app's zinc-950 dark UI) ───────────────────────
const darkMapStyles = [
  { elementType: 'geometry',                                   stylers: [{ color: '#18181b' }] },
  { elementType: 'labels.text.stroke',                         stylers: [{ color: '#18181b' }] },
  { elementType: 'labels.text.fill',                           stylers: [{ color: '#71717a' }] },
  { featureType: 'administrative.locality',  elementType: 'labels.text.fill',  stylers: [{ color: '#a1a1aa' }] },
  { featureType: 'poi',                      elementType: 'labels.text.fill',  stylers: [{ color: '#71717a' }] },
  { featureType: 'poi.park',                 elementType: 'geometry',           stylers: [{ color: '#1c1c1f' }] },
  { featureType: 'poi.park',                 elementType: 'labels.text.fill',  stylers: [{ color: '#4b5563' }] },
  { featureType: 'road',                     elementType: 'geometry',           stylers: [{ color: '#27272a' }] },
  { featureType: 'road',                     elementType: 'geometry.stroke',    stylers: [{ color: '#212124' }] },
  { featureType: 'road',                     elementType: 'labels.text.fill',   stylers: [{ color: '#9ca3af' }] },
  { featureType: 'road.highway',             elementType: 'geometry',           stylers: [{ color: '#3f3f46' }] },
  { featureType: 'road.highway',             elementType: 'geometry.stroke',    stylers: [{ color: '#2d2d30' }] },
  { featureType: 'road.highway',             elementType: 'labels.text.fill',   stylers: [{ color: '#d4d4d8' }] },
  { featureType: 'transit',                  elementType: 'geometry',           stylers: [{ color: '#1c1c1f' }] },
  { featureType: 'transit.station',          elementType: 'labels.text.fill',   stylers: [{ color: '#a1a1aa' }] },
  { featureType: 'water',                    elementType: 'geometry',           stylers: [{ color: '#0f172a' }] },
  { featureType: 'water',                    elementType: 'labels.text.fill',   stylers: [{ color: '#3b82f6' }] },
  { featureType: 'water',                    elementType: 'labels.text.stroke', stylers: [{ color: '#0f172a' }] },
];


// Safe Google Maps symbol accessor — returns null only if the API hasn't loaded yet.
// NOTE: SymbolPath.CIRCLE === 0 which is falsy — must check !== null, not !!value.
const gmSymbol = (name) => {
  try {
    const val = window.google?.maps?.SymbolPath?.[name];
    return val !== undefined ? val : null;
  } catch { return null; }
};

// Shown when the Maps API key is missing / quota exceeded
const MapLoadError = ({ incidents = [] }) => (
  <div className="w-full h-full flex flex-col items-center justify-center bg-zinc-900 gap-4 p-6">
    <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
      <AlertTriangle className="w-6 h-6 text-amber-400" />
    </div>
    <div className="text-center">
      <p className="text-sm font-bold text-zinc-200">Map unavailable</p>
      <p className="text-xs text-zinc-500 mt-1">The map could not be loaded. Please contact your administrator.</p>
    </div>
    {incidents.length > 0 && (
      <div className="w-full max-w-sm space-y-2 mt-2">
        <div className="absolute bottom-6 left-4 float-card p-3 text-xs space-y-1.5 z-10">
          <p className="text-zinc-500 font-bold uppercase tracking-wider text-[10px] mb-2">Legend</p>
          {[['SOS Emergency','bg-red-500 ring-2 ring-white ring-offset-1 ring-offset-transparent'],['Critical','bg-red-500'],['High','bg-orange-500'],['Medium','bg-yellow-500'],['Low','bg-green-500']].map(([label, color]) => (
            <div key={label} className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${color} ${label === 'SOS Emergency' ? 'animate-pulse' : ''}`} />
              <span className="text-zinc-300">{label}</span>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">Recent Incidents ({incidents.length})</p>
        {incidents.slice(0, 5).map(inc => (
          <div key={inc._id} className="flex items-center gap-2 p-2.5 bg-zinc-800 border border-zinc-700 rounded-xl">
            <span className="text-base">{TYPE_ICONS[inc.type] || '📍'}</span>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-zinc-200 truncate">{inc.title}</p>
              <p className="text-[10px] text-zinc-500">{inc.type} · {inc.severity}</p>
            </div>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
              style={{ backgroundColor: (SEVERITY_HEX[inc.severity] || '#94a3b8') + '22', color: SEVERITY_HEX[inc.severity] || '#94a3b8' }}>
              {inc.severity?.toUpperCase()}
            </span>
          </div>
        ))}
      </div>
    )}
  </div>
);

const LiveMap = ({
  incidents       = [],
  latestIncidentId = null,
  shelters        = [],
  showShelters    = false,
  highlightShelterId = null,
}) => {
  const [selectedIncident, setSelectedIncident] = useState(null);
  const [selectedShelter,  setSelectedShelter]  = useState(null);
  const [pulsingId,   setPulsingId]   = useState(null);
  const [pulseOpacity, setPulseOpacity] = useState(0.6);
  const [mapError,    setMapError]    = useState(false);
  const mapRef = useRef(null);

  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '',
  });

  const onMapLoad = useCallback((map) => { mapRef.current = map; }, []);

  // Auto-fit the map to show ALL incident markers on initial load
  useEffect(() => {
    if (!mapRef.current || !incidents.length) return;
    const validCoords = incidents
      .map(i => i.location?.coordinates)
      .filter(c => Array.isArray(c) && c.length === 2 && !(c[0] === 0 && c[1] === 0));
    if (!validCoords.length) return;
    const bounds = new window.google.maps.LatLngBounds();
    validCoords.forEach(([lng, lat]) => bounds.extend({ lat, lng }));
    mapRef.current.fitBounds(bounds, 80); // 80px padding
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapRef.current, incidents.length]);

  // Auto-pan + pulse on new incident
  useEffect(() => {
    if (!latestIncidentId || !mapRef.current) return;
    const incident = incidents.find(i => i._id === latestIncidentId);
    if (!incident?.location?.coordinates) return;
    const [lng, lat] = incident.location.coordinates;
    if (!lat || !lng) return;
    mapRef.current.panTo({ lat, lng });
    mapRef.current.setZoom(10);
    setPulsingId(latestIncidentId);
    setPulseOpacity(0.6);
    const fadeTimer = setTimeout(() => setPulseOpacity(0), 3000);
    const clearTimer = setTimeout(() => setPulsingId(null), 4500);
    setSelectedIncident(incident);
    return () => { clearTimeout(fadeTimer); clearTimeout(clearTimer); };
  }, [latestIncidentId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Pan to highlighted shelter
  useEffect(() => {
    if (!highlightShelterId || !mapRef.current) return;
    const shelter = shelters.find(s => s._id === highlightShelterId);
    if (!shelter?.location?.coordinates) return;
    const [lng, lat] = shelter.location.coordinates;
    mapRef.current.panTo({ lat, lng });
    mapRef.current.setZoom(14);
    setSelectedShelter(shelter);
  }, [highlightShelterId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loadError || mapError) {
    return <MapLoadError incidents={incidents} />;
  }

  if (!isLoaded) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-zinc-900 text-zinc-400">
        <div className="flex flex-col items-center gap-3">
          <MapPin className="w-8 h-8 text-zinc-700 animate-bounce" />
          <span className="text-sm">Loading map…</span>
        </div>
      </div>
    );
  }

  return (
    <GoogleMap
      mapContainerStyle={containerStyle}
      center={defaultCenter}
      zoom={5}
      onLoad={onMapLoad}
      onClick={() => { setSelectedIncident(null); setSelectedShelter(null); }}
      options={{
        styles: darkMapStyles,
        disableDefaultUI: false,
        zoomControl: true,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
      }}
    >
      {/* ── Incident markers ─────────────────────────────────────────────── */}
      {(() => {
        // Build a map of coordinate key → list of incidents at that spot.
        // Incidents sharing the same lat/lng get a small spiral offset so they
        // are all independently clickable instead of stacking invisibly.
        const coordGroups = {};
        incidents.forEach(inc => {
          const [lng, lat] = inc.location?.coordinates || [0, 0];
          // Skip incidents with no real coordinates (0,0 = unfilled placeholder)
          if (lng === 0 && lat === 0) return;
          const key = `${lat.toFixed(5)},${lng.toFixed(5)}`;
          if (!coordGroups[key]) coordGroups[key] = [];
          coordGroups[key].push({ inc, lat, lng });
        });

        const circSym = gmSymbol('CIRCLE');
        if (circSym === null) return null; // Maps API not yet loaded

        return Object.values(coordGroups).flatMap((group) =>
          group.map(({ inc: incident, lat: rawLat, lng: rawLng }, idx) => {
            // Spiral offset so stacked markers fan out slightly
            // (angle steps of 45°, radius grows per extra marker)
            const angle  = (idx * Math.PI * 0.75);
            const radius = idx === 0 ? 0 : 0.003 * Math.ceil(idx / 2);
            const lat    = rawLat + (idx === 0 ? 0 : Math.sin(angle) * radius);
            const lng    = rawLng + (idx === 0 ? 0 : Math.cos(angle) * radius);

            const isNew  = incident._id === pulsingId;
            const isSOS  = incident.isSOS || incident.type === 'sos';
            const color  = isSOS ? '#ef4444' : (SEVERITY_HEX[incident.severity] || '#94a3b8');
            const isSel  = selectedIncident?._id === incident._id;
            const scale  = isSOS
              ? (isNew ? 22 : 18)
              : isNew
                ? (incident.severity === 'critical' ? 18 : 14)
                : (incident.severity === 'critical' ? 14 : incident.severity === 'high' ? 11 : 9);

            return (
              <div key={incident._id}>
                {(isNew || isSOS) && PULSE_RADII.map((r, i) => (
                  <Circle
                    key={`pulse-${r}`}
                    center={{ lat, lng }}
                    radius={isSOS ? r * 1.5 : r}
                    options={{
                      strokeColor:   color,
                      strokeOpacity: (isNew ? pulseOpacity : 0.35) * (1 - i * 0.25),
                      strokeWeight:  isSOS ? 3 : 2,
                      fillColor:     color,
                      fillOpacity:   (isNew ? pulseOpacity : 0.2) * 0.08 * (1 - i * 0.3),
                      zIndex:        0,
                    }}
                  />
                ))}
                <Marker
                  position={{ lat, lng }}
                  title={incident.title}
                  onClick={() => { setSelectedIncident(incident); setSelectedShelter(null); }}
                  zIndex={isSOS ? 9999 : isNew ? 999 : isSel ? 100 : 1}
                  icon={{
                    path:         circSym,
                    scale,
                    fillColor:    color,
                    fillOpacity:  0.95,
                    strokeWeight: isSOS ? 4 : (isNew ? 3 : 2),
                    strokeColor:  '#ffffff',
                  }}
                />
              </div>
            );
          })
        );
      })()}

      {/* Incident InfoWindow */}
      {selectedIncident && (
        <InfoWindow
          position={{
            lat: selectedIncident.location.coordinates[1],
            lng: selectedIncident.location.coordinates[0],
          }}
          onCloseClick={() => setSelectedIncident(null)}
        >
          <div className="max-w-xs p-2 font-sans bg-zinc-900 text-zinc-200 -m-1 rounded">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">
                {selectedIncident.isSOS || selectedIncident.type === 'sos' ? '🆘' : (TYPE_ICONS[selectedIncident.type] || '📍')}
              </span>
              <h3 className="font-bold text-zinc-100 text-sm leading-tight">
                {selectedIncident.isSOS || selectedIncident.type === 'sos' ? '🚨 SOS — ' : ''}{selectedIncident.title}
              </h3>
            </div>
            <div className="flex gap-2 mb-2.5">
              <span className="text-xs font-semibold px-2 py-0.5 rounded"
                style={{ backgroundColor: SEVERITY_HEX[selectedIncident.severity] + '22', color: SEVERITY_HEX[selectedIncident.severity], border: `1px solid ${SEVERITY_HEX[selectedIncident.severity]}44` }}>
                {selectedIncident.severity?.toUpperCase()}
              </span>
              <span className="text-xs px-2 py-0.5 bg-zinc-800 text-zinc-400 rounded border border-zinc-700">
                {selectedIncident.type?.replace('_', ' ')}
              </span>
            </div>
            <p className="text-xs text-zinc-400 mb-2.5 line-clamp-3 leading-relaxed">{selectedIncident.description}</p>
            {selectedIncident.aiTriage?.summary && (
              <div className="bg-blue-950/40 border border-blue-900/50 rounded-lg p-2.5 mb-2">
                <p className="text-xs font-bold text-blue-400 mb-1 flex items-center gap-1">🤖 AI Summary</p>
                <p className="text-xs text-blue-200/90 leading-relaxed">{selectedIncident.aiTriage.summary}</p>
                {selectedIncident.aiTriage.riskScore != null && (
                  <p className="text-[11px] text-blue-400/80 mt-1.5 font-medium">Risk: <strong>{selectedIncident.aiTriage.riskScore}/100</strong></p>
                )}
              </div>
            )}
            {selectedIncident.location?.address && (
              <p className="text-[11px] text-zinc-500 mt-1 font-medium flex items-center gap-1">📍 {selectedIncident.location.address}</p>
            )}
          </div>
        </InfoWindow>
      )}

      {/* ── Shelter markers (shown when showShelters=true) ──────────────── */}
      {showShelters && shelters.map((shelter) => {
        const [lng, lat] = shelter.location?.coordinates || [0, 0];
        if (!lat || !lng) return null;
        const colors    = SHELTER_STATUS_HEX[shelter.status] || SHELTER_STATUS_HEX.active;
        const isHighlit = shelter._id === highlightShelterId;
        const isSel     = selectedShelter?._id === shelter._id;
        const arrowSym  = gmSymbol('BACKWARD_CLOSED_ARROW');
        if (!arrowSym) return null;

        return (
          <Marker
            key={`shelter-${shelter._id}`}
            position={{ lat, lng }}
            title={shelter.name}
            onClick={() => { setSelectedShelter(shelter); setSelectedIncident(null); }}
            zIndex={isHighlit ? 500 : isSel ? 200 : 50}
            icon={{
              path:        arrowSym,
              scale:       isHighlit ? 10 : isSel ? 8 : 6,
              fillColor:   colors.fill,
              fillOpacity: 0.92,
              strokeWeight: 2,
              strokeColor: colors.stroke,
              rotation:    180,
            }}
          />
        );
      })}

      {/* Shelter InfoWindow */}
      {selectedShelter && (
        <InfoWindow
          position={{
            lat: selectedShelter.location.coordinates[1],
            lng: selectedShelter.location.coordinates[0],
          }}
          onCloseClick={() => setSelectedShelter(null)}
        >
          <div className="max-w-sm p-2 font-sans bg-zinc-900 text-zinc-200 -m-1 rounded">
            <div className="flex items-start gap-2 mb-3">
              <span className="text-2xl">{SHELTER_TYPE_META[selectedShelter.type]?.icon || '📍'}</span>
              <div>
                <h3 className="font-bold text-zinc-100 text-sm leading-tight">{selectedShelter.name}</h3>
                <p className="text-xs text-zinc-500 mt-0.5">{selectedShelter.location?.address}</p>
              </div>
            </div>

            {/* Occupancy bar */}
            <div className="mb-3 p-2 bg-zinc-800/50 rounded-lg border border-zinc-700/50">
              <div className="flex justify-between text-xs text-zinc-400 mb-1.5">
                <span>Occupancy</span>
                <span className="font-semibold text-zinc-300">{selectedShelter.currentOccupancy} / {selectedShelter.totalCapacity}</span>
              </div>
              <div className="h-2 bg-zinc-700 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${Math.min(100, Math.round(((selectedShelter.currentOccupancy||0)/(selectedShelter.totalCapacity||1))*100))}%`,
                    backgroundColor: selectedShelter.status === 'full' ? '#ef4444' : selectedShelter.status === 'active' ? '#22c55e' : '#3b82f6',
                  }}
                />
              </div>
              <p className="text-[11px] mt-1.5 font-bold tracking-wide"
                style={{ color: selectedShelter.status === 'full' ? '#f87171' : selectedShelter.status === 'active' ? '#4ade80' : '#60a5fa' }}>
                {selectedShelter.availableSpots !== undefined
                  ? `${selectedShelter.availableSpots} SPOTS AVAILABLE`
                  : selectedShelter.status === 'full' ? 'FULL' : selectedShelter.status.toUpperCase()}
              </p>
            </div>

            {/* Amenities */}
            {selectedShelter.amenities && (
              <div className="flex flex-wrap gap-1.5 mb-3">
                {selectedShelter.amenities.food      && <span className="text-[10px] bg-green-900/40 border border-green-800/50 text-green-400 px-1.5 py-0.5 rounded">🍛 Food</span>}
                {selectedShelter.amenities.water     && <span className="text-[10px] bg-blue-900/40 border border-blue-800/50 text-blue-400 px-1.5 py-0.5 rounded">💧 Water</span>}
                {selectedShelter.amenities.medical   && <span className="text-[10px] bg-red-900/40 border border-red-800/50 text-red-400 px-1.5 py-0.5 rounded">🏥 Medical</span>}
                {selectedShelter.amenities.electricity && <span className="text-[10px] bg-yellow-900/40 border border-yellow-800/50 text-yellow-400 px-1.5 py-0.5 rounded">⚡ Power</span>}
                {selectedShelter.amenities.wifi      && <span className="text-[10px] bg-purple-900/40 border border-purple-800/50 text-purple-400 px-1.5 py-0.5 rounded">📶 WiFi</span>}
                {selectedShelter.amenities.bedding   && <span className="text-[10px] bg-indigo-900/40 border border-indigo-800/50 text-indigo-400 px-1.5 py-0.5 rounded">🛏️ Beds</span>}
                {selectedShelter.amenities.childCare && <span className="text-[10px] bg-pink-900/40 border border-pink-800/50 text-pink-400 px-1.5 py-0.5 rounded">👶 Child Care</span>}
                {selectedShelter.amenities.wheelchairAccessible && <span className="text-[10px] bg-zinc-800 border border-zinc-700 text-zinc-400 px-1.5 py-0.5 rounded">♿ Accessible</span>}
              </div>
            )}

            {/* Contact */}
            {selectedShelter.contacts?.[0] && (
              <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-lg p-2 mt-1">
                <p className="text-[11px] font-bold text-zinc-300">{selectedShelter.contacts[0].name}</p>
                <p className="text-[10px] text-zinc-500 mb-0.5">{selectedShelter.contacts[0].role}</p>
                <a href={`tel:${selectedShelter.contacts[0].phone}`} className="text-[11px] text-blue-400 font-medium hover:text-blue-300 transition-colors">
                  📞 {selectedShelter.contacts[0].phone}
                </a>
              </div>
            )}

            {selectedShelter.distanceKm !== undefined && (
              <p className="text-[10px] text-zinc-500 mt-2 font-medium">📏 {selectedShelter.distanceKm} km away</p>
            )}
          </div>
        </InfoWindow>
      )}
    </GoogleMap>
  );
};

export default LiveMap;
