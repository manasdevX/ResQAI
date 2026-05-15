import { useState, useCallback, useRef, useEffect } from 'react';
import { GoogleMap, useJsApiLoader, Marker, InfoWindow, Circle } from '@react-google-maps/api';

const containerStyle = { width: '100%', height: '100%' };
const defaultCenter = { lat: 20.5937, lng: 78.9629 };

const SEVERITY_COLORS = {
  critical: '#ef4444',
  high:     '#f97316',
  medium:   '#eab308',
  low:      '#22c55e',
};

const TYPE_ICONS = {
  fire:               '🔥',
  flood:              '🌊',
  earthquake:         '🌍',
  cyclone:            '🌀',
  landslide:          '🏔️',
  accident:           '🚗',
  medical_emergency:  '🚑',
  building_collapse:  '🏚️',
  chemical_spill:     '☣️',
  riot:               '⚠️',
  other:              '📍',
};

// Pulsing ring animation radii
const PULSE_RADII = [3000, 6000, 9000];

const LiveMap = ({ incidents = [], latestIncidentId = null }) => {
  const [selectedIncident, setSelectedIncident] = useState(null);
  const [pulsingId, setPulsingId] = useState(null);
  const [pulseOpacity, setPulseOpacity] = useState(0.6);
  const mapRef = useRef(null);

  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '',
  });

  const onMapLoad = useCallback((map) => {
    mapRef.current = map;
  }, []);

  // When a new incident arrives: pan map + trigger pulse ring + auto-open InfoWindow
  useEffect(() => {
    if (!latestIncidentId || !mapRef.current) return;

    const incident = incidents.find(i => i._id === latestIncidentId);
    if (!incident?.location?.coordinates) return;

    const [lng, lat] = incident.location.coordinates;
    if (!lat || !lng) return;

    // Pan & zoom to new incident
    mapRef.current.panTo({ lat, lng });
    mapRef.current.setZoom(10);

    // Start pulse animation
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPulsingId(latestIncidentId);
    setPulseOpacity(0.6);

    // Fade out pulse rings after 4 seconds
    const fadeTimer = setTimeout(() => {
      setPulseOpacity(0);
    }, 3000);
    const clearTimer = setTimeout(() => {
      setPulsingId(null);
    }, 4500);

    // Auto-open InfoWindow for the new incident
    setSelectedIncident(incident);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(clearTimer);
    };
  }, [latestIncidentId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!isLoaded) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-zinc-900 text-zinc-400">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm">Loading map...</span>
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
      options={{
        styles: darkMapStyles,
        disableDefaultUI: false,
        zoomControl: true,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
      }}
    >
      {incidents.map((incident) => {
        const [lng, lat] = incident.location?.coordinates || [0, 0];
        if (!lat || !lng) return null;

        const isNew = incident._id === pulsingId;
        const color = SEVERITY_COLORS[incident.severity] || '#94a3b8';

        return (
          <div key={incident._id}>
            {/* Pulsing ripple rings for the latest incident */}
            {isNew && PULSE_RADII.map((radius, i) => (
              <Circle
                key={`pulse-${radius}`}
                center={{ lat, lng }}
                radius={radius * (i + 1)}
                options={{
                  strokeColor: color,
                  strokeOpacity: pulseOpacity * (1 - i * 0.25),
                  strokeWeight: 2,
                  fillColor: color,
                  fillOpacity: pulseOpacity * 0.06 * (1 - i * 0.3),
                  zIndex: 0,
                }}
              />
            ))}

            {/* Main marker */}
            <Marker
              position={{ lat, lng }}
              title={incident.title}
              onClick={() => setSelectedIncident(incident)}
              zIndex={isNew ? 999 : 1}
              icon={{
                path: window.google.maps.SymbolPath.CIRCLE,
                scale: isNew
                  ? (incident.severity === 'critical' ? 18 : 14)
                  : (incident.severity === 'critical' ? 14 : incident.severity === 'high' ? 11 : 9),
                fillColor: color,
                fillOpacity: 0.95,
                strokeWeight: isNew ? 3 : 2,
                strokeColor: isNew ? '#ffffff' : '#ffffff',
              }}
            />
          </div>
        );
      })}

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
              <span
                className="text-xs font-semibold px-2 py-0.5 rounded"
                style={{
                  backgroundColor: SEVERITY_COLORS[selectedIncident.severity] + '22',
                  color: SEVERITY_COLORS[selectedIncident.severity],
                  border: `1px solid ${SEVERITY_COLORS[selectedIncident.severity]}44`,
                }}
              >
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
                <p className="text-xs text-blue-500 mt-1">
                  Risk: <strong>{selectedIncident.aiTriage.riskScore}/100</strong>
                </p>
              </div>
            )}
            {selectedIncident.location?.address && (
              <p className="text-xs text-gray-400 mt-2">📍 {selectedIncident.location.address}</p>
            )}
          </div>
        </InfoWindow>
      )}
    </GoogleMap>
  );
};

// Dark mode map styles
const darkMapStyles = [
  { elementType: 'geometry', stylers: [{ color: '#1a1a2e' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#1a1a2e' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#746855' }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#d59563' }] },
  { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#d59563' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#263c3f' }] },
  { featureType: 'poi.park', elementType: 'labels.text.fill', stylers: [{ color: '#6b9a76' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#16213e' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#0f3460' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#9ca5b3' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#0f3460' }] },
  { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#1a1a2e' }] },
  { featureType: 'road.highway', elementType: 'labels.text.fill', stylers: [{ color: '#f3d19c' }] },
  { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#16213e' }] },
  { featureType: 'transit.station', elementType: 'labels.text.fill', stylers: [{ color: '#d59563' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0e2954' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#515c6d' }] },
  { featureType: 'water', elementType: 'labels.text.stroke', stylers: [{ color: '#17263c' }] },
];

export default LiveMap;
