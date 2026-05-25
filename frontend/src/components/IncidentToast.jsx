import { useEffect, useState } from 'react';

const SEVERITY_STYLES = {
  critical: { bar: 'bg-red-500',    icon: '🚨', text: 'text-red-400',    bg: 'bg-red-950/60 border-red-800/60' },
  high:     { bar: 'bg-orange-500', icon: '⚠️', text: 'text-orange-400', bg: 'bg-orange-950/60 border-orange-800/60' },
  medium:   { bar: 'bg-yellow-500', icon: '🔔', text: 'text-yellow-400', bg: 'bg-yellow-950/60 border-yellow-800/60' },
  low:      { bar: 'bg-green-500',  icon: '📋', text: 'text-green-400',  bg: 'bg-green-950/60 border-green-800/60' },
};

const IncidentToast = ({ incident, onDismiss }) => {
  const [visible, setVisible] = useState(false);
  const style = SEVERITY_STYLES[incident?.severity] || SEVERITY_STYLES.medium;

  // Animate in
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 50);
    return () => clearTimeout(t);
  }, []);

  // Auto-dismiss after 6 seconds
  useEffect(() => {
    const t = setTimeout(() => {
      setVisible(false);
      setTimeout(onDismiss, 400); // Wait for exit animation
    }, 6000);
    return () => clearTimeout(t);
  }, [onDismiss]);

  return (
    <div
      className={`relative overflow-hidden w-80 rounded-xl border backdrop-blur-sm shadow-2xl transition-[opacity,transform] duration-300 ${style.bg} ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'
      }`}
    >
      {/* Severity colour bar */}
      <div className={`absolute left-0 top-0 bottom-0 w-1 ${style.bar}`} />

      <div className="pl-4 pr-3 py-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-2 flex-1 min-w-0">
            <span className="text-xl shrink-0 mt-0.5">{style.icon}</span>
            <div className="min-w-0">
              <p className="text-xs font-bold text-zinc-300 uppercase tracking-wider mb-0.5">
                New Incident — {incident?.severity?.toUpperCase()}
              </p>
              <p className="text-sm font-semibold text-white truncate">{incident?.title}</p>
              <p className="text-xs text-zinc-400 mt-0.5 line-clamp-2">{incident?.description}</p>
              {incident?.aiTriage && (
                <p className={`text-xs mt-1 font-medium ${style.text}`}>
                  🤖 Risk score: {incident.aiTriage.riskScore}/100
                </p>
              )}
            </div>
          </div>
          <button
            onClick={() => { setVisible(false); setTimeout(onDismiss, 400); }}
            className="text-zinc-500 hover:text-zinc-300 text-lg leading-none mt-0.5 shrink-0"
          >
            ×
          </button>
        </div>
      </div>

      {/* Auto-dismiss progress bar */}
      <div className={`h-0.5 ${style.bar} opacity-40 animate-[shrink_6s_linear_forwards]`} />
    </div>
  );
};

export default IncidentToast;
