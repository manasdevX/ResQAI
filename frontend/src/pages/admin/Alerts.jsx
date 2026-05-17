import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Radio, Send, CheckCircle, AlertTriangle } from 'lucide-react';

const ALERT_TYPES = [
  { value: 'evacuation', label: 'Evacuation',   icon: '🚨', color: 'border-red-600/40 text-red-400 bg-red-950/30' },
  { value: 'medical',    label: 'Medical',      icon: '🚑', color: 'border-orange-600/40 text-orange-400 bg-orange-950/30' },
  { value: 'shelter',    label: 'Shelter',      icon: '🏠', color: 'border-blue-600/40 text-blue-400 bg-blue-950/30' },
  { value: 'general',   label: 'General Info', icon: '📢', color: 'border-zinc-600/40 text-zinc-400 bg-zinc-800/40' },
];

const AdminAlerts = () => {
  const { api } = useAuth();
  const [alertType, setAlertType] = useState('general');
  const [message,   setMessage]   = useState('');
  const [sending,   setSending]   = useState(false);
  const [sent,      setSent]      = useState(false);
  const [error,     setError]     = useState('');

  const handleBroadcast = async (e) => {
    e.preventDefault();
    if (!message.trim()) { setError('Message cannot be empty'); return; }
    setSending(true);
    setError('');
    try {
      await api.post('/incidents/broadcast-alert', { alertType, message: message.trim() });
      setSent(true);
      setMessage('');
      setTimeout(() => setSent(false), 4000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to broadcast alert');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-red-600/20 border border-red-600/30 flex items-center justify-center">
            <Radio className="w-5 h-5 text-red-400" />
          </div>
          <div>
            <h1 className="text-lg font-black text-zinc-100">Broadcast Alert</h1>
            <p className="text-xs text-zinc-500 mt-0.5">Send emergency alerts to all connected users in real time</p>
          </div>
        </div>

        {sent && (
          <div className="flex items-center gap-3 mb-5 p-4 bg-green-950/40 border border-green-700/40 rounded-2xl">
            <CheckCircle className="w-5 h-5 text-green-400 shrink-0" />
            <div>
              <p className="text-sm font-bold text-green-400">Alert Broadcast Sent</p>
              <p className="text-xs text-green-300/70 mt-0.5">All online users have been notified.</p>
            </div>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 mb-5 p-4 bg-red-950/40 border border-red-800/40 rounded-2xl text-red-400 text-sm">
            <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
          </div>
        )}

        <form onSubmit={handleBroadcast} className="space-y-5">
          <div>
            <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3 block">Alert Type</label>
            <div className="grid grid-cols-2 gap-2.5">
              {ALERT_TYPES.map(({ value, label, icon, color }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setAlertType(value)}
                  className={`flex items-center gap-3 p-3.5 rounded-xl border text-sm font-semibold transition-all ${
                    alertType === value ? color : 'border-zinc-700 bg-zinc-800/30 text-zinc-400 hover:border-zinc-600'
                  }`}
                >
                  <span className="text-xl">{icon}</span>
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2 block">Message</label>
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder="e.g. Flood warning in Sector 4 — all residents evacuate to Rampur Relief Camp immediately…"
              rows={5}
              maxLength={500}
              className="w-full px-4 py-3 bg-zinc-900 border border-zinc-700 rounded-xl text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition resize-none"
            />
            <p className="text-[10px] text-zinc-600 mt-1.5 text-right">{message.length}/500</p>
          </div>

          <div className="p-3.5 bg-zinc-800/40 border border-zinc-700/40 rounded-xl text-xs text-zinc-500">
            This alert will appear as a banner on every connected user's screen, regardless of their role. Use responsibly.
          </div>

          <button
            type="submit"
            disabled={sending || !message.trim()}
            className="w-full flex items-center justify-center gap-2.5 py-3.5 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white rounded-xl font-bold text-sm transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <Send className="w-4 h-4" />
            {sending ? 'Broadcasting…' : 'Broadcast Alert to All Users'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default AdminAlerts;
