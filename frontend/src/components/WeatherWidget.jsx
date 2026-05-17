import { useState, useEffect } from 'react';
import { Wind, Thermometer, Eye, RefreshCw } from 'lucide-react';

const WMO_CODES = {
  0:  { label: 'Clear sky',        icon: '☀️' },
  1:  { label: 'Mainly clear',     icon: '🌤️' },
  2:  { label: 'Partly cloudy',    icon: '⛅' },
  3:  { label: 'Overcast',         icon: '☁️' },
  45: { label: 'Foggy',            icon: '🌫️' },
  48: { label: 'Icy fog',          icon: '🌫️' },
  51: { label: 'Light drizzle',    icon: '🌦️' },
  53: { label: 'Drizzle',          icon: '🌦️' },
  55: { label: 'Heavy drizzle',    icon: '🌧️' },
  61: { label: 'Light rain',       icon: '🌧️' },
  63: { label: 'Rain',             icon: '🌧️' },
  65: { label: 'Heavy rain',       icon: '🌧️' },
  71: { label: 'Light snow',       icon: '🌨️' },
  73: { label: 'Snow',             icon: '❄️' },
  75: { label: 'Heavy snow',       icon: '❄️' },
  80: { label: 'Rain showers',     icon: '🌦️' },
  81: { label: 'Showers',          icon: '🌧️' },
  82: { label: 'Violent showers',  icon: '⛈️' },
  95: { label: 'Thunderstorm',     icon: '⛈️' },
  99: { label: 'Severe storm',     icon: '🌩️' },
};

const getWeather = (code) => WMO_CODES[code] || { label: 'Unknown', icon: '🌡️' };

const WeatherWidget = ({ compact = false }) => {
  const [weather, setWeather] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  const fetchWeather = (lat, lng) => {
    setLoading(true);
    setError(null);
    fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current_weather=true&timezone=auto`
    )
      .then(r => r.json())
      .then(data => {
        const cw = data.current_weather;
        setWeather({
          temp:      Math.round(cw.temperature),
          windspeed: Math.round(cw.windspeed),
          code:      cw.weathercode,
          isDay:     cw.is_day === 1,
        });
        setLoading(false);
      })
      .catch(() => {
        setError('Weather unavailable');
        setLoading(false);
      });
  };

  useEffect(() => {
    if (!navigator.geolocation) { setError('Geolocation not supported'); setLoading(false); return; }
    navigator.geolocation.getCurrentPosition(
      pos => fetchWeather(pos.coords.latitude, pos.coords.longitude),
      ()  => { setError('Location permission denied'); setLoading(false); },
      { timeout: 8000, maximumAge: 300000 }
    );
  }, []);

  if (loading) {
    return (
      <div className={`flex items-center gap-2 ${compact ? 'px-3 py-2 bg-zinc-800/60 rounded-xl' : 'p-4 bg-zinc-900 border border-zinc-800 rounded-2xl'}`}>
        <RefreshCw className="w-4 h-4 text-zinc-500 animate-spin" />
        <span className="text-xs text-zinc-500">Loading weather…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`flex items-center gap-2 ${compact ? 'px-3 py-2 bg-zinc-800/60 rounded-xl' : 'p-4 bg-zinc-900 border border-zinc-800 rounded-2xl'}`}>
        <span className="text-xs text-zinc-500">{error}</span>
      </div>
    );
  }

  const wmo = getWeather(weather.code);

  if (compact) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-zinc-800/60 rounded-xl border border-zinc-700/40">
        <span className="text-lg">{wmo.icon}</span>
        <span className="text-sm font-semibold text-zinc-200">{weather.temp}°C</span>
        <span className="text-xs text-zinc-500 hidden sm:block">{wmo.label}</span>
      </div>
    );
  }

  return (
    <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-2xl">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Local Weather</p>
        <span className="text-xs text-zinc-600">{weather.isDay ? 'Day' : 'Night'}</span>
      </div>

      <div className="flex items-center gap-4">
        <span className="text-4xl">{wmo.icon}</span>
        <div>
          <p className="text-2xl font-black text-zinc-100">{weather.temp}°C</p>
          <p className="text-xs text-zinc-400 mt-0.5">{wmo.label}</p>
        </div>
      </div>

      <div className="flex items-center gap-4 mt-3 pt-3 border-t border-zinc-800">
        <div className="flex items-center gap-1.5 text-xs text-zinc-400">
          <Wind className="w-3 h-3 text-blue-400" />
          {weather.windspeed} km/h
        </div>
        <div className="flex items-center gap-1.5 text-xs text-zinc-400">
          <Thermometer className="w-3 h-3 text-orange-400" />
          {weather.temp}° feels like
        </div>
      </div>

      {weather.code >= 80 && (
        <div className="mt-3 flex items-center gap-2 p-2.5 bg-orange-950/40 border border-orange-800/40 rounded-lg">
          <Eye className="w-3.5 h-3.5 text-orange-400 shrink-0" />
          <p className="text-xs text-orange-300">Adverse weather — take extra precautions</p>
        </div>
      )}
    </div>
  );
};

export default WeatherWidget;
