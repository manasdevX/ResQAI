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


// Safe Google Maps symbol accessor — returns null before API loads
const gmSymbol = (name) => {
  try { return window.google?.maps?.SymbolPath?.[name] ?? null; }
  catch { return null; }
};

// Shown when the Maps API key is missing / quota exceeded
const MapLoadError = ({ incidents = [] }) => (
  <div className="w-full h-full flex flex-col items-center justify-center bg-zinc-900 gap-4 p-6">
    <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
      <AlertTriangle className="w-6 h-6 text-amber-400" />
    </div>
    <div className="text-center">
      <p className="text-sm font-bold text-zinc-200">Map unavailable</p>
      <p className="text-xs text-zinc-500 mt-1">Google Maps could not load. Check your API key in frontend/.env</p>
    </div>
    {incidents.length > 0 && (
      <div className="w-full max-w-sm space-y-2 mt-2">
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
      {incidents.map((incident) => {
        const [lng, lat] = incident.location?.coordinates || [0, 0];
        if (!lat || !lng) return null;
        const isNew   = incident._id === pulsingId;
        const color   = SEVERITY_HEX[incident.severity] || '#94a3b8';
        const isSel   = selectedIncident?._id === incident._id;
        const circSym = gmSymbol('CIRCLE');
        if (!circSym) return null;

        return (
          <div key={incident._id}>
            {isNew && PULSE_RADII.map((radius, i) => (
              <Circle
                key={`pulse-${radius}`}
                center={{ lat, lng }}
                radius={radius}
                options={{
                  strokeColor:   color,
                  strokeOpacity: pulseOpacity * (1 - i * 0.25),
                  strokeWeight:  2,
                  fillColor:     color,
                  fillOpacity:   pulseOpacity * 0.06 * (1 - i * 0.3),
                  zIndex:        0,
                }}
              />
            ))}

            <Marker
              position={{ lat, lng }}
              title={incident.title}
              onClick={() => { setSelectedIncident(incident); setSelectedShelter(null); }}
              zIndex={isNew ? 999 : isSel ? 100 : 1}
              icon={{
                path:        circSym,
                scale:       isNew ? (incident.severity === 'critical' ? 18 : 14) : (incident.severity === 'critical' ? 14 : incident.severity === 'high' ? 11 : 9),
                fillColor:   color,
                fillOpacity: 0.95,
                strokeWeight: isNew ? 3 : 2,
                strokeColor: '#ffffff',
              }}
            />
          </div>
        );
      })}

      {/* Incident InfoWindow */}
      {selectedIncident && (
        <InfoWindow
          position={{
            lat: selectedIncident.location.coordinates[1],
            lng: selectedIncident.location.coordinates[0],
          }}
          onCloseClick={() => setSelectedIncident(null)}
        >
          <div className="max-w-xs p-1 font-sans">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-lg">{TYPE_ICONS[selectedIncident.type] || '📍'}</span>
              <h3 className="font-bold text-gray-900 text-sm leading-tight">{selectedIncident.title}</h3>
            </div>
            <div className="flex gap-2 mb-2">
              <span className="text-xs font-semibold px-2 py-0.5 rounded"
                style={{ backgroundColor: SEVERITY_HEX[selectedIncident.severity] + '22', color: SEVERITY_HEX[selectedIncident.severity], border: `1px solid ${SEVERITY_HEX[selectedIncident.severity]}44` }}>
                {selectedIncident.severity?.toUpperCase()}
              </span>
              <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded border border-gray-200">
                {selectedIncident.type?.replace('_', ' ')}
              </span>
            </div>
            <p className="text-xs text-gray-600 mb-2 line-clamp-3">{selectedIncident.description}</p>
            {selectedIncident.aiTriage && (
              <div className="bg-blue-50 border border-blue-200 rounded p-2">
                <p className="text-xs font-semibold text-blue-700 mb-0.5">🤖 AI Summary</p>
                <p className="text-xs text-blue-600">{selectedIncident.aiTriage.summary}</p>
                <p className="text-xs text-blue-500 mt-1">Risk: <strong>{selectedIncident.aiTriage.riskScore}/100</strong></p>
              </div>
            )}
            {selectedIncident.location?.address && (
              <p className="text-xs text-gray-400 mt-2">📍 {selectedIncident.location.address}</p>
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
          <div className="max-w-sm p-2 font-sans">
            <div className="flex items-start gap-2 mb-2">
              <span className="text-2xl">{SHELTER_TYPE_META[selectedShelter.type]?.icon || '📍'}</span>
              <div>
                <h3 className="font-bold text-gray-900 text-sm leading-tight">{selectedShelter.name}</h3>
                <p className="text-xs text-gray-500 mt-0.5">{selectedShelter.location?.address}</p>
              </div>
            </div>

            {/* Occupancy bar */}
            <div className="mb-2">
              <div className="flex justify-between text-xs text-gray-600 mb-1">
                <span>Occupancy</span>
                <span className="font-semibold">{selectedShelter.currentOccupancy} / {selectedShelter.totalCapacity}</span>
              </div>
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${Math.min(100, Math.round(((selectedShelter.currentOccupancy||0)/(selectedShelter.totalCapacity||1))*100))}%`,
                    backgroundColor: selectedShelter.status === 'full' ? '#ef4444' : selectedShelter.status === 'active' ? '#22c55e' : '#3b82f6',
                  }}
                />
              </div>
              <p className="text-xs mt-1 font-medium"
                style={{ color: selectedShelter.status === 'full' ? '#ef4444' : selectedShelter.status === 'active' ? '#16a34a' : '#2563eb' }}>
                {selectedShelter.availableSpots !== undefined
                  ? `${selectedShelter.availableSpots} spots available`
                  : selectedShelter.status === 'full' ? 'FULL' : selectedShelter.status.toUpperCase()}
              </p>
            </div>

            {/* Amenities */}
            {selectedShelter.amenities && (
              <div className="flex flex-wrap gap-1 mb-2">
                {selectedShelter.amenities.food      && <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded">🍛 Food</span>}
                {selectedShelter.amenities.water     && <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">💧 Water</span>}
                {selectedShelter.amenities.medical   && <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded">🏥 Medical</span>}
                {selectedShelter.amenities.electricity && <span className="text-[10px] bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded">⚡ Power</span>}
                {selectedShelter.amenities.wifi      && <span className="text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">📶 WiFi</span>}
                {selectedShelter.amenities.bedding   && <span className="text-[10px] bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded">🛏️ Beds</span>}
                {selectedShelter.amenities.childCare && <span className="text-[10px] bg-pink-100 text-pink-700 px-1.5 py-0.5 rounded">👶 Child Care</span>}
                {selectedShelter.amenities.wheelchairAccessible && <span className="text-[10px] bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded">♿ Accessible</span>}
              </div>
            )}

            {/* Contact */}
            {selectedShelter.contacts?.[0] && (
              <div className="bg-gray-50 border border-gray-200 rounded p-1.5">
                <p className="text-xs font-semibold text-gray-700">{selectedShelter.contacts[0].name}</p>
                <p className="text-xs text-gray-500">{selectedShelter.contacts[0].role}</p>
                <a href={`tel:${selectedShelter.contacts[0].phone}`} className="text-xs text-blue-600 font-medium">
                  📞 {selectedShelter.contacts[0].phone}
                </a>
              </div>
            )}

            {selectedShelter.distanceKm !== undefined && (
              <p className="text-xs text-gray-400 mt-1.5">📏 {selectedShelter.distanceKm} km away</p>
            )}
          </div>
        </InfoWindow>
      )}
    </GoogleMap>
  );
};

export default LiveMap;
