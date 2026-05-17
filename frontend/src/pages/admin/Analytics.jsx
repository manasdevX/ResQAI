import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { RefreshCw, AlertTriangle, TrendingUp, Activity, Clock, Users } from 'lucide-react';

import { TYPE_ICONS, SEVERITY_BAR, INCIDENT_STATUS_BAR } from '../../constants/incident';

const HBar = ({ label, value, max, colorClass, icon }) => {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      {icon && <span className="text-base shrink-0 w-5 text-center">{icon}</span>}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-zinc-400 truncate capitalize">{label.replace('_',' ')}</span>
          <span className="text-xs font-bold text-zinc-200 ml-2 shrink-0">{value}</span>
        </div>
        <div className="h-1.5 bg-zinc-700/60 rounded-full overflow-hidden">
          <div className={`h-full rounded-full ${colorClass} transition-all duration-700`} style={{ width: `${pct}%` }} />
        </div>
      </div>
    </div>
  );
};

const StatCard = ({ label, value, sub, icon: Icon, color }) => (
  <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
    <div className="flex items-start justify-between gap-2">
      <div>
        <p className="text-2xl font-black text-zinc-100">{value}</p>
        <p className="text-xs font-semibold text-zinc-400 mt-0.5">{label}</p>
        {sub && <p className="text-[10px] text-zinc-600 mt-1">{sub}</p>}
      </div>
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${color}`}>
        <Icon className="w-4 h-4" />
      </div>
    </div>
  </div>
);

const getLast7Days = () => {
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push({ label: d.toLocaleDateString('en', { weekday: 'short' }), date: d.toDateString() });
  }
  return days;
};

const AdminAnalytics = () => {
  const { api } = useAuth();
  const [incidents, setIncidents] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get('/incidents');
      setIncidents(data.incidents || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => { fetch(); }, [fetch]);

  if (loading) {
    return (
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <div key={i} className="h-24 bg-zinc-900 border border-zinc-800 rounded-2xl animate-pulse" />)}
        </div>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {[1,2,3,4].map(i => <div key={i} className="h-48 bg-zinc-900 border border-zinc-800 rounded-2xl animate-pulse" />)}
        </div>
      </div>
    );
  }

  // ── Derived stats ──────────────────────────────────────────────────────────────
  const total       = incidents.length;
  const active      = incidents.filter(i => !['resolved','closed'].includes(i.status)).length;
  const resolved    = incidents.filter(i => i.status === 'resolved').length;
  const sosCount    = incidents.filter(i => i.isSOS).length;
  const criticals   = incidents.filter(i => i.severity === 'critical').length;

  const avgResTime = (() => {
    const resolvedWithTime = incidents.filter(i =>
      i.status === 'resolved' &&
      i.statusHistory?.some(h => h.status === 'resolved')
    );
    if (!resolvedWithTime.length) return null;
    const totalMs = resolvedWithTime.reduce((acc, i) => {
      const resolvedEntry = i.statusHistory.find(h => h.status === 'resolved');
      return acc + (new Date(resolvedEntry.changedAt) - new Date(i.createdAt));
    }, 0);
    const avgMs = totalMs / resolvedWithTime.length;
    const avgH  = Math.round(avgMs / (1000 * 60 * 60));
    return avgH < 1 ? '< 1h' : `~${avgH}h`;
  })();

  // By severity
  const bySeverity = ['critical','high','medium','low'].map(s => ({
    label: s, value: incidents.filter(i => i.severity === s).length,
  }));
  const maxSev = Math.max(...bySeverity.map(x => x.value), 1);

  // By type
  const typeMap = {};
  incidents.forEach(i => { typeMap[i.type] = (typeMap[i.type] || 0) + 1; });
  const byType = Object.entries(typeMap).sort(([,a],[,b]) => b - a);
  const maxType = Math.max(...byType.map(([,v]) => v), 1);

  // By status
  const statusMap = {};
  incidents.forEach(i => { statusMap[i.status] = (statusMap[i.status] || 0) + 1; });
  const byStatus = Object.entries(statusMap).sort(([,a],[,b]) => b - a);
  const maxStatus = Math.max(...byStatus.map(([,v]) => v), 1);

  // Last 7 days
  const days = getLast7Days();
  const byDay = days.map(({ label, date }) => ({
    label,
    value: incidents.filter(i => new Date(i.createdAt).toDateString() === date).length,
  }));
  const maxDay = Math.max(...byDay.map(d => d.value), 1);

  // Resolution rate
  const resolutionRate = total > 0 ? Math.round(((resolved) / total) * 100) : 0;

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-black text-zinc-100">Analytics</h1>
          <p className="text-xs text-zinc-500 mt-0.5">Incident trends and response statistics</p>
        </div>
        <button onClick={fetch} className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg text-xs font-medium text-zinc-300 transition">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-950/40 border border-red-800/40 rounded-xl text-red-400 text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard label="Total Incidents"     value={total}           sub="All time"                    icon={Activity}  color="bg-blue-500/10 border border-blue-500/20 text-blue-400" />
        <StatCard label="Active Now"          value={active}          sub={`${criticals} critical`}     icon={AlertTriangle} color="bg-red-500/10 border border-red-500/20 text-red-400" />
        <StatCard label="Resolved"            value={resolved}        sub={`${resolutionRate}% rate`}   icon={TrendingUp} color="bg-green-500/10 border border-green-500/20 text-green-400" />
        <StatCard label="SOS Emergencies"     value={sosCount}        sub="Total triggered"             icon={Users}     color="bg-orange-500/10 border border-orange-500/20 text-orange-400" />
      </div>

      {/* Avg response time badge */}
      {avgResTime && (
        <div className="flex items-center gap-3 p-4 bg-zinc-900 border border-zinc-800 rounded-2xl">
          <Clock className="w-5 h-5 text-purple-400 shrink-0" />
          <div>
            <p className="text-sm font-bold text-zinc-100">Average Resolution Time: <span className="text-purple-400">{avgResTime}</span></p>
            <p className="text-xs text-zinc-500 mt-0.5">Calculated from resolved incidents with status history</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

        {/* Incidents last 7 days */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
          <h3 className="text-sm font-bold text-zinc-200 mb-4">Incidents — Last 7 Days</h3>
          <div className="flex items-end gap-2 h-28">
            {byDay.map(({ label, value }) => {
              const heightPct = maxDay > 0 ? Math.round((value / maxDay) * 100) : 0;
              return (
                <div key={label} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-[10px] text-zinc-400 font-semibold">{value || ''}</span>
                  <div className="w-full bg-zinc-700/50 rounded-t-sm overflow-hidden flex flex-col justify-end" style={{ height: '80px' }}>
                    <div
                      className="w-full bg-blue-500 rounded-t-sm transition-all duration-700"
                      style={{ height: `${heightPct}%` }}
                    />
                  </div>
                  <span className="text-[9px] text-zinc-600">{label}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* By Severity */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
          <h3 className="text-sm font-bold text-zinc-200 mb-4">Incidents by Severity</h3>
          <div className="space-y-3">
            {bySeverity.map(({ label, value }) => (
              <HBar key={label} label={label} value={value} max={maxSev} colorClass={SEVERITY_BAR[label]?.bar || 'bg-zinc-500'} />
            ))}
          </div>
          {/* Donut-style summary */}
          <div className="flex gap-2 mt-5 flex-wrap">
            {bySeverity.map(({ label, value }) => (
              <div key={label} className={`flex-1 min-w-[80px] p-2.5 rounded-xl border text-center ${SEVERITY_BAR[label]?.bg}`}>
                <p className={`text-lg font-black ${SEVERITY_BAR[label]?.text}`}>{value}</p>
                <p className="text-[10px] text-zinc-500 capitalize">{label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* By Type */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
          <h3 className="text-sm font-bold text-zinc-200 mb-4">Incidents by Type</h3>
          <div className="space-y-3">
            {byType.length === 0
              ? <p className="text-sm text-zinc-500 text-center py-6">No data yet</p>
              : byType.map(([type, value]) => (
                  <HBar key={type} label={type} value={value} max={maxType} colorClass="bg-purple-500" icon={TYPE_ICONS[type] || '📍'} />
                ))
            }
          </div>
        </div>

        {/* By Status */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
          <h3 className="text-sm font-bold text-zinc-200 mb-4">Incidents by Status</h3>
          <div className="space-y-3">
            {byStatus.length === 0
              ? <p className="text-sm text-zinc-500 text-center py-6">No data yet</p>
              : byStatus.map(([status, value]) => (
                  <HBar key={status} label={status} value={value} max={maxStatus} colorClass={INCIDENT_STATUS_BAR[status]?.bar || 'bg-zinc-500'} />
                ))
            }
          </div>
          {/* Resolution rate ring (simple) */}
          <div className="mt-5 p-3 bg-zinc-800/50 border border-zinc-700/40 rounded-xl flex items-center gap-4">
            <div className="relative w-14 h-14 shrink-0">
              <svg className="w-14 h-14 -rotate-90" viewBox="0 0 56 56">
                <circle cx="28" cy="28" r="22" fill="none" stroke="#3f3f46" strokeWidth="6" />
                <circle
                  cx="28" cy="28" r="22" fill="none"
                  stroke="#22c55e" strokeWidth="6"
                  strokeDasharray={`${2 * Math.PI * 22}`}
                  strokeDashoffset={`${2 * Math.PI * 22 * (1 - resolutionRate / 100)}`}
                  strokeLinecap="round"
                  className="transition-all duration-700"
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-xs font-black text-zinc-100">{resolutionRate}%</span>
            </div>
            <div>
              <p className="text-sm font-bold text-zinc-200">Resolution Rate</p>
              <p className="text-xs text-zinc-500 mt-0.5">{resolved} of {total} incidents resolved</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminAnalytics;
