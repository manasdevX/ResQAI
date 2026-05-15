import { useEffect, useState } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const SEVERITY_COLORS = {
  critical: 'bg-red-500/20 text-red-400 border-red-500/30',
  high:     'bg-orange-500/20 text-orange-400 border-orange-500/30',
  medium:   'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  low:      'bg-green-500/20 text-green-400 border-green-500/30',
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

// Helper to calculate haversine distance in km between two coordinates
const getDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Radius of the earth in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * 
    Math.sin(dLon / 2) * Math.sin(dLon / 2); 
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)); 
  const d = R * c; // Distance in km
  return d.toFixed(1);
};

const VolunteerDashboard = () => {
  const { token, user, logout } = useAuth();
  
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [location, setLocation] = useState(null);
  const [radius, setRadius] = useState(20); // default 20km

  const fetchNearby = async (lat, lng, maxDistKm) => {
    setLoading(true);
    try {
      // MongoDB expects maxDistance in meters
      const maxDistanceMeters = maxDistKm * 1000;
      const { data } = await axios.get(`http://localhost:5000/api/incidents/nearby?lat=${lat}&lng=${lng}&maxDistance=${maxDistanceMeters}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setIncidents(data.incidents);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch nearby incidents:', err);
      setError('Failed to fetch incidents.');
    } finally {
      setLoading(false);
    }
  };

  const locateAndFetch = (currentRadius) => {
    setLoading(true);
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser');
      setLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setLocation({ lat: latitude, lng: longitude });
        fetchNearby(latitude, longitude, currentRadius);
      },
      (err) => {
        console.error('Geolocation error:', err);
        setError('Please enable location access to find nearby incidents.');
        setLoading(false);
      }
    );
  };

  // Initial load
  useEffect(() => {
    locateAndFetch(radius);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle radius change
  const handleRadiusChange = (e) => {
    const newRadius = parseInt(e.target.value);
    setRadius(newRadius);
    if (location) {
      fetchNearby(location.lat, location.lng, newRadius);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
      {/* ── Top Nav ── */}
      <header className="flex items-center justify-between px-6 py-4 bg-zinc-900 border-b border-zinc-800 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-sm font-bold">V</div>
          <div>
            <h1 className="text-base font-bold leading-none">ResQAI Volunteer</h1>
            <p className="text-xs text-zinc-400 leading-none mt-1">Field Response Dashboard</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <span className="text-sm text-zinc-400 hidden sm:block">Hello, {user?.name || 'Volunteer'}</span>
          <button
            onClick={logout}
            className="text-xs px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-md border border-zinc-700 transition"
          >
            Logout
          </button>
        </div>
      </header>

      {/* ── Main Content ── */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-6 space-y-6">
        
        {/* Controls Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-zinc-900/50 p-4 rounded-xl border border-zinc-800">
          <div>
            <h2 className="text-xl font-bold">Nearby Incidents</h2>
            <p className="text-sm text-zinc-400 mt-1">
              Showing active emergencies requiring assistance.
            </p>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-zinc-500 font-medium">Search Radius (km)</label>
              <select 
                value={radius} 
                onChange={handleRadiusChange}
                className="bg-zinc-800 border border-zinc-700 rounded-md text-sm px-3 py-1.5 focus:outline-none focus:border-blue-500"
              >
                <option value={5}>5 km</option>
                <option value={10}>10 km</option>
                <option value={20}>20 km</option>
                <option value={50}>50 km</option>
                <option value={100}>100 km</option>
              </select>
            </div>
            
            <button
              onClick={() => locateAndFetch(radius)}
              className="mt-5 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-medium transition flex items-center gap-2"
            >
              <span>📍</span> Refresh
            </button>
          </div>
        </div>

        {/* Status / Errors */}
        {error && (
          <div className="p-4 bg-red-950/50 border border-red-900 rounded-xl text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Feed Grid */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-zinc-500">
            <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4" />
            <p>Locating emergencies near you...</p>
          </div>
        ) : incidents.length === 0 && !error ? (
          <div className="flex flex-col items-center justify-center py-20 text-zinc-500 bg-zinc-900/30 rounded-xl border border-zinc-800 border-dashed">
            <span className="text-4xl mb-4">🙌</span>
            <p className="text-lg font-medium text-zinc-300">All clear!</p>
            <p className="text-sm mt-1">No active incidents found within {radius}km.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {incidents.map((inc) => {
              // Calculate distance if we have user location and incident location
              let distanceStr = '';
              if (location && inc.location?.coordinates) {
                const [lng, lat] = inc.location.coordinates;
                distanceStr = `${getDistance(location.lat, location.lng, lat, lng)} km away`;
              }

              return (
                <div key={inc._id} className="flex flex-col bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden hover:border-zinc-700 transition">
                  <div className="p-5 flex-1">
                    <div className="flex justify-between items-start mb-3">
                      <span className="text-3xl">{TYPE_ICONS[inc.type] || '📍'}</span>
                      <div className="text-right">
                        <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded border ${SEVERITY_COLORS[inc.severity]}`}>
                          {inc.severity?.toUpperCase()}
                        </span>
                        {distanceStr && (
                          <p className="text-xs text-blue-400 font-medium mt-1.5">{distanceStr}</p>
                        )}
                      </div>
                    </div>
                    
                    <h3 className="font-bold text-lg mb-1 leading-tight">{inc.title}</h3>
                    <p className="text-xs text-zinc-400 flex items-center gap-1 mb-3">
                      <span>📍</span> {inc.location?.address || 'Location unknown'}
                    </p>
                    
                    <p className="text-sm text-zinc-300 line-clamp-3 mb-4">
                      {inc.description}
                    </p>

                    {inc.aiTriage?.recommendedActions && (
                      <div className="bg-zinc-950/50 p-3 rounded-lg border border-zinc-800/50">
                        <p className="text-xs font-semibold text-zinc-400 mb-1.5">Suggested Action:</p>
                        <p className="text-xs text-zinc-300">
                          {inc.aiTriage.recommendedActions[0] || 'Proceed with caution.'}
                        </p>
                      </div>
                    )}
                  </div>
                  
                  <div className="px-5 py-3 bg-zinc-800/30 border-t border-zinc-800 mt-auto flex items-center justify-between">
                    <span className="text-xs font-medium px-2 py-1 bg-zinc-800 rounded text-zinc-300 uppercase">
                      {inc.status}
                    </span>
                    <button className="text-sm font-semibold text-blue-500 hover:text-blue-400 transition">
                      View Details →
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
};

export default VolunteerDashboard;
