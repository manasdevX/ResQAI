import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { RefreshCw, AlertTriangle, TrendingUp, Activity, Clock, Users, Building2, Shield } from 'lucide-react';

import { TYPE_ICONS, SEVERITY_BAR, INCIDENT_STATUS_BAR } from '../../constants/incident';

const HBar = ({ label, value, max, colorClass, icon }) => {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      {icon && <span className="text-base shrink-0 w-5 text-center">{icon}</span>}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-zinc-400 truncate capitalize">{label.replace('_', ' ')}</span>
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
  <div className="bg-zinc-900/80 border border-zinc-800/80 rounded-2xl p-4 card-hover transition-all">
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0 flex-1">
        <p className="text-2xl font-black text-zinc-100 tabular-nums tracking-tight">{value ?? '—'}</p>
        <p className="text-xs font-semibold text-zinc-400 mt-1 leading-tight">{label}</p>
        {sub && <p className="text-[10px] text-zinc-600 mt-1 leading-snug">{sub}</p>}
      </div>
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${color}`}>
        <Icon className="w-4 h-4" />
      </div>
    </div>
  </div>
);

const AdminAnalytics = () => {
  const { api } = useAuth();
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  const fetchSummary = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: res } = await api.get('/analytics/summary');
      if (res.success) setData(res.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => { fetchSummary(); }, [fetchSummary]);

  if (loading) {
    return (
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-24 bg-zinc-900 border border-zinc-800 rounded-2xl animate-pulse" />)}
        </div>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-48 bg-zinc-900 border border-zinc-800 rounded-2xl animate-pulse" />)}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex-1 overflow-y-auto p-6">
        <div className="flex items-center gap-2 p-4 bg-red-950/40 border border-red-800/40 rounded-xl text-red-400 text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0" /> {error || 'No data available'}
          <button onClick={fetchSummary} className="ml-auto flex items-center gap-1 text-xs underline hover:text-red-300">
            <RefreshCw className="w-3 h-3" /> Retry
          </button>
        </div>
      </div>
    );
  }

  const { incidents, shelters, responders, last14Days } = data;

  // Last 7 days from the 14-day array
  const last7Days = last14Days.slice(-7);
  const maxDay    = Math.max(...last7Days.map(d => d.count), 1);

  // Reshape aggregation arrays into maps
  const sevMap    = Object.fromEntries(incidents.bySeverity.map(x => [x._id, x.count]));
  const statusMap = Object.fromEntries(incidents.byStatus.map(x => [x._id, x.count]));

  const bySeverity = ['critical', 'high', 'medium', 'low'].map(s => ({ label: s, value: sevMap[s] || 0 }));
  const maxSev     = Math.max(...bySeverity.map(x => x.value), 1);
  const maxStatus  = Math.max(...incidents.byStatus.map(x => x.count), 1);
  const maxType    = Math.max(...incidents.byType.map(x => x.count), 1);

  return (
    <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-black text-zinc-100 tracking-tight">Analytics</h1>
          <p className="text-xs text-zinc-500 mt-0.5">Incident trends and operational response statistics</p>
        </div>
        <button
          onClick={fetchSummary}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-2 bg-zinc-800/80 hover:bg-zinc-700/80 border border-zinc-700/60 rounded-xl text-xs font-semibold text-zinc-300 hover:text-zinc-100 transition-all"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      {/* KPI cards — row 1: incident stats */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard label="Total Incidents"  value={incidents.total}     sub="All time"                          icon={Activity}     color="bg-blue-500/10 border border-blue-500/20 text-blue-400" />
        <StatCard label="Active Now"       value={incidents.active}    sub={`${incidents.critical} critical`}  icon={AlertTriangle} color="bg-red-500/10 border border-red-500/20 text-red-400" />
        <StatCard label="Resolved"         value={incidents.resolved}  sub={`${incidents.resolutionRate}% rate`} icon={TrendingUp}  color="bg-green-500/10 border border-green-500/20 text-green-400" />
        <StatCard label="SOS Emergencies"  value={incidents.sosCount}  sub="Total triggered"                   icon={Shield}       color="bg-orange-500/10 border border-orange-500/20 text-orange-400" />
      </div>

      {/* KPI cards — row 2: operational stats */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          label="Responders on Duty"
          value={responders.available}
          sub={`of ${responders.total} registered`}
          icon={Users}
          color="bg-blue-500/10 border border-blue-500/20 text-blue-400"
        />
        <StatCard
          label="Active Shelters"
          value={shelters.activeShelters}
          sub={`of ${shelters.totalShelters} total`}
          icon={Building2}
          color="bg-purple-500/10 border border-purple-500/20 text-purple-400"
        />
        <StatCard
          label="Shelter Utilization"
          value={`${shelters.utilizationRate}%`}
          sub={`${shelters.totalOccupancy} / ${shelters.totalCapacity} capacity`}
          icon={Building2}
          color="bg-yellow-500/10 border border-yellow-500/20 text-yellow-400"
        />
        <StatCard
          label="Avg Resolution Time"
          value={incidents.avgResolutionTime || 'N/A'}
          sub={incidents.avgResolutionCount > 0 ? `From ${incidents.avgResolutionCount} resolved` : 'No resolved incidents yet'}
          icon={Clock}
          color="bg-purple-500/10 border border-purple-500/20 text-purple-400"
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

        {/* Last 7 days bar chart */}
        <div className="bg-zinc-900/80 border border-zinc-800/80 rounded-2xl p-5">
          <h3 className="text-sm font-bold text-zinc-200 mb-4">Incidents — Last 7 Days</h3>
          <div className="flex items-end gap-2 h-28">
            {last7Days.map(({ date, count }) => {
              const heightPct = maxDay > 0 ? Math.round((count / maxDay) * 100) : 0;
              const label     = new Date(date + 'T12:00:00').toLocaleDateString('en', { weekday: 'short' });
              return (
                <div key={date} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-[10px] text-zinc-400 font-semibold">{count || ''}</span>
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
        <div className="bg-zinc-900/80 border border-zinc-800/80 rounded-2xl p-5">
          <h3 className="text-sm font-bold text-zinc-200 mb-4">Incidents by Severity</h3>
          <div className="space-y-3">
            {bySeverity.map(({ label, value }) => (
              <HBar key={label} label={label} value={value} max={maxSev} colorClass={SEVERITY_BAR[label]?.bar || 'bg-zinc-500'} />
            ))}
          </div>
          <div className="flex gap-2 mt-5 flex-wrap">
            {bySeverity.map(({ label, value }) => (
              <div key={label} className={`flex-1 min-w-[70px] p-2.5 rounded-xl border text-center ${SEVERITY_BAR[label]?.bg}`}>
                <p className={`text-lg font-black ${SEVERITY_BAR[label]?.text}`}>{value}</p>
                <p className="text-[10px] text-zinc-500 capitalize">{label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* By Type */}
        <div className="bg-zinc-900/80 border border-zinc-800/80 rounded-2xl p-5">
          <h3 className="text-sm font-bold text-zinc-200 mb-4">Incidents by Type</h3>
          <div className="space-y-3">
            {incidents.byType.length === 0
              ? <p className="text-sm text-zinc-500 text-center py-6">No data yet</p>
              : incidents.byType.map(({ _id: type, count: value }) => (
                  <HBar key={type} label={type} value={value} max={maxType} colorClass="bg-purple-500" icon={TYPE_ICONS[type] || '📍'} />
                ))
            }
          </div>
        </div>

        {/* By Status + resolution ring */}
        <div className="bg-zinc-900/80 border border-zinc-800/80 rounded-2xl p-5">
          <h3 className="text-sm font-bold text-zinc-200 mb-4">Incidents by Status</h3>
          <div className="space-y-3">
            {incidents.byStatus.length === 0
              ? <p className="text-sm text-zinc-500 text-center py-6">No data yet</p>
              : incidents.byStatus.map(({ _id: status, count: value }) => (
                  <HBar key={status} label={status} value={value} max={maxStatus} colorClass={INCIDENT_STATUS_BAR[status]?.bar || 'bg-zinc-500'} />
                ))
            }
          </div>
          <div className="mt-5 p-3 bg-zinc-800/50 border border-zinc-700/40 rounded-xl flex items-center gap-4">
            <div className="relative w-14 h-14 shrink-0">
              <svg className="w-14 h-14 -rotate-90" viewBox="0 0 56 56">
                <circle cx="28" cy="28" r="22" fill="none" stroke="#3f3f46" strokeWidth="6" />
                <circle
                  cx="28" cy="28" r="22" fill="none"
                  stroke="#22c55e" strokeWidth="6"
                  strokeDasharray={`${2 * Math.PI * 22}`}
                  strokeDashoffset={`${2 * Math.PI * 22 * (1 - incidents.resolutionRate / 100)}`}
                  strokeLinecap="round"
                  className="transition-all duration-700"
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-xs font-black text-zinc-100">{incidents.resolutionRate}%</span>
            </div>
            <div>
              <p className="text-sm font-bold text-zinc-200">Resolution Rate</p>
              <p className="text-xs text-zinc-500 mt-0.5">{incidents.resolved} of {incidents.total} incidents resolved</p>
            </div>
          </div>
        </div>

        {/* Shelter utilization */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 xl:col-span-2">
          <h3 className="text-sm font-bold text-zinc-200 mb-4">Shelter Utilization</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'Total Shelters',    value: shelters.totalShelters,  color: 'text-zinc-100' },
              { label: 'Active Shelters',   value: shelters.activeShelters, color: 'text-green-400' },
              { label: 'Total Capacity',    value: shelters.totalCapacity,  color: 'text-blue-400' },
              { label: 'Current Occupancy', value: shelters.totalOccupancy, color: 'text-orange-400' },
            ].map(({ label, value, color }) => (
              <div key={label} className="p-3 bg-zinc-800/50 border border-zinc-700/40 rounded-xl text-center">
                <p className={`text-2xl font-black ${color}`}>{value}</p>
                <p className="text-[10px] text-zinc-500 mt-0.5">{label}</p>
              </div>
            ))}
          </div>
          {shelters.totalCapacity > 0 && (
            <div className="mt-4">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs text-zinc-400">Capacity used</span>
                <span className="text-xs font-bold text-zinc-200">{shelters.utilizationRate}%</span>
              </div>
              <div className="h-2 bg-zinc-700/60 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${
                    shelters.utilizationRate >= 90 ? 'bg-red-500' :
                    shelters.utilizationRate >= 70 ? 'bg-orange-500' :
                    'bg-green-500'
                  }`}
                  style={{ width: `${shelters.utilizationRate}%` }}
                />
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default AdminAnalytics;
