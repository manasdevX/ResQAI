import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { X, Loader2, CheckCircle, MapPin, AlertTriangle } from 'lucide-react';

const RESOURCE_TYPES = [
  { value: 'food',     label: 'Food',     icon: '🍱' },
  { value: 'water',    label: 'Water',    icon: '💧' },
  { value: 'medical',  label: 'Medical',  icon: '🏥' },
  { value: 'rescue',   label: 'Rescue',   icon: '🚨' },
  { value: 'shelter',  label: 'Shelter',  icon: '🏠' },
  { value: 'clothing', label: 'Clothing', icon: '👕' },
];

const URGENCY_LEVELS = [
  { value: 'low',      label: 'Low',      color: 'border-green-600/40 text-green-400 bg-green-950/30' },
  { value: 'medium',   label: 'Medium',   color: 'border-yellow-600/40 text-yellow-400 bg-yellow-950/30' },
  { value: 'high',     label: 'High',     color: 'border-orange-600/40 text-orange-400 bg-orange-950/30' },
  { value: 'critical', label: 'Critical', color: 'border-red-600/40 text-red-400 bg-red-950/30' },
];

const ResourceRequestModal = ({ onClose, onSuccess }) => {
  const { api } = useAuth();

  const [type,        setType]        = useState('');
  const [description, setDescription] = useState('');
  const [urgency,     setUrgency]     = useState('medium');
  const [phase,       setPhase]       = useState('form'); // form | sending | done | error
  const [errorMsg,    setErrorMsg]    = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!type) return;
    setPhase('sending');
    setErrorMsg('');

    try {
      const coords = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          pos => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
          err => reject(err),
          { timeout: 10000, enableHighAccuracy: false }
        );
      });

      await api.post('/resources', {
        type,
        description: description.trim() || undefined,
        urgency,
        location: {
          type:        'Point',
          coordinates: [coords.lng, coords.lat],
          address:     `${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`,
        },
      });

      setPhase('done');
      setTimeout(() => { onSuccess?.(); onClose?.(); }, 2500);
    } catch (err) {
      const msg = err.code === 1 ? 'Location permission denied. Enable GPS and try again.'
               : err.response?.data?.message || 'Failed to submit request. Try again.';
      setErrorMsg(msg);
      setPhase('error');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-md bg-zinc-900 border border-zinc-700 rounded-2xl shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
          <div>
            <h2 className="text-base font-bold text-zinc-100">Request Resources</h2>
            <p className="text-xs text-zinc-500 mt-0.5">Volunteers nearby will see and fulfill your request</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-zinc-800 rounded-lg transition">
            <X className="w-4 h-4 text-zinc-400" />
          </button>
        </div>

        {phase === 'done' ? (
          <div className="p-8 text-center">
            <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-3" />
            <p className="text-base font-bold text-zinc-100">Request Submitted!</p>
            <p className="text-sm text-zinc-400 mt-1.5">Volunteers near you have been notified.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-5 space-y-5">

            {/* Resource type */}
            <div>
              <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2 block">
                What do you need? <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-3 gap-2">
                {RESOURCE_TYPES.map(({ value, label, icon }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setType(value)}
                    className={`flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl border text-xs font-semibold transition-all ${
                      type === value
                        ? 'border-blue-500 bg-blue-600/20 text-blue-300'
                        : 'border-zinc-700 bg-zinc-800/50 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200'
                    }`}
                  >
                    <span className="text-xl">{icon}</span>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Urgency */}
            <div>
              <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2 block">Urgency</label>
              <div className="flex gap-2">
                {URGENCY_LEVELS.map(({ value, label, color }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setUrgency(value)}
                    className={`flex-1 py-1.5 rounded-lg border text-xs font-semibold transition-all ${
                      urgency === value ? color : 'border-zinc-700 text-zinc-500 bg-zinc-800/30 hover:border-zinc-600'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2 block">
                Additional details <span className="font-normal text-zinc-600">(optional)</span>
              </label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="e.g. Family of 4, need water and basic medicines…"
                rows={3}
                maxLength={500}
                className="w-full px-3.5 py-2.5 bg-zinc-800 border border-zinc-700 rounded-xl text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition resize-none"
              />
            </div>

            {/* GPS note */}
            <div className="flex items-center gap-2 text-xs text-zinc-500">
              <MapPin className="w-3.5 h-3.5 shrink-0" />
              Your current GPS location will be shared with volunteers
            </div>

            {phase === 'error' && (
              <div className="flex items-center gap-2 p-3 bg-red-950/40 border border-red-800/40 rounded-xl text-sm text-red-400">
                <AlertTriangle className="w-4 h-4 shrink-0" /> {errorMsg}
              </div>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-xl text-sm font-medium text-zinc-300 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!type || phase === 'sending'}
                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl text-sm font-semibold transition flex items-center justify-center gap-2"
              >
                {phase === 'sending'
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Submitting…</>
                  : phase === 'error' ? 'Try Again' : 'Submit Request'
                }
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default ResourceRequestModal;
