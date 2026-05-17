import { useState, useCallback, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { AlertTriangle, Loader2, CheckCircle, X } from 'lucide-react';

const SOSButton = () => {
  const { api } = useAuth();
  const [phase, setPhase] = useState('idle'); // idle | confirm | sending | done | error
  const [errorMsg, setErrorMsg] = useState('');
  const timerRef = useRef(null);

  // Clear any pending auto-reset timers on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const scheduleReset = (delay = 4000) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setPhase('idle'), delay);
  };

  const handleClick = () => {
    if (phase === 'idle') setPhase('confirm');
  };

  const handleCancel = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setPhase('idle');
  };

  const handleConfirm = useCallback(async () => {
    setPhase('sending');
    try {
      const coords = await new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
          reject(new Error('Geolocation not supported by this browser'));
          return;
        }
        navigator.geolocation.getCurrentPosition(
          pos => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
          err => reject(err),
          { timeout: 10000, enableHighAccuracy: true }
        );
      });

      await api.post('/incidents/sos', {
        location: {
          type:        'Point',
          coordinates: [coords.lng, coords.lat],
          address:     `${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`,
        },
      });

      setPhase('done');
      scheduleReset(4000);
    } catch (err) {
      const msg = err.code === 1 ? 'Location permission denied. Enable GPS and try again.'
               : err.message === 'Geolocation not supported by this browser' ? err.message
               : err.response?.data?.message || 'Failed to send SOS. Try again.';
      setErrorMsg(msg);
      setPhase('error');
      scheduleReset(5000);
    }
  }, [api]); // eslint-disable-line react-hooks/exhaustive-deps

  if (phase === 'done') {
    return (
      <div className="flex items-center gap-3 p-4 bg-green-950/60 border border-green-700/50 rounded-2xl">
        <CheckCircle className="w-6 h-6 text-green-400 shrink-0" />
        <div>
          <p className="text-sm font-bold text-green-400">SOS Alert Sent</p>
          <p className="text-xs text-green-300/70 mt-0.5">Emergency responders have been notified with your location.</p>
        </div>
      </div>
    );
  }

  if (phase === 'error') {
    return (
      <div className="flex items-center gap-3 p-4 bg-red-950/60 border border-red-700/50 rounded-2xl">
        <AlertTriangle className="w-6 h-6 text-red-400 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-red-400">SOS Failed</p>
          <p className="text-xs text-red-300/70 mt-0.5">{errorMsg}</p>
        </div>
        <button onClick={handleCancel} className="shrink-0 p-1 hover:bg-red-900/40 rounded-lg transition">
          <X className="w-4 h-4 text-red-400" />
        </button>
      </div>
    );
  }

  if (phase === 'confirm') {
    return (
      <div className="p-4 bg-red-950/40 border-2 border-red-600/60 rounded-2xl space-y-3">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-bold text-red-300">Send SOS Alert?</p>
            <p className="text-xs text-red-300/60 mt-1 leading-relaxed">
              This will alert all emergency responders with your GPS location. Only use in a genuine emergency.
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleConfirm}
            className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 text-white text-sm font-bold rounded-xl transition-all active:scale-95"
          >
            YES, SEND SOS
          </button>
          <button
            onClick={handleCancel}
            className="px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm font-medium rounded-xl border border-zinc-700 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={handleClick}
      disabled={phase === 'sending'}
      className="relative w-full flex items-center justify-center gap-3 py-4 bg-red-600 hover:bg-red-500 disabled:opacity-70 text-white rounded-2xl font-black text-lg tracking-wide shadow-xl shadow-red-600/30 transition-all hover:scale-[1.02] active:scale-[0.98] overflow-hidden group"
    >
      {/* Pulse ring */}
      <span className="absolute inset-0 rounded-2xl bg-red-500 animate-ping opacity-20 group-hover:opacity-0 transition" />

      {phase === 'sending'
        ? <><Loader2 className="w-5 h-5 animate-spin" /> Getting location…</>
        : <><AlertTriangle className="w-5 h-5" /> SOS EMERGENCY</>
      }
    </button>
  );
};

export default SOSButton;
