import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import ResourceRequestModal from '../../components/ResourceRequestModal';
import { RefreshCw, Package, MapPin, Clock, CheckCircle, AlertTriangle, Plus } from 'lucide-react';

const TYPE_ICONS = {
  food:     { icon: '🍱', label: 'Food',     color: 'text-orange-400 bg-orange-500/10 border-orange-500/30' },
  water:    { icon: '💧', label: 'Water',    color: 'text-blue-400 bg-blue-500/10 border-blue-500/30' },
  medical:  { icon: '🏥', label: 'Medical',  color: 'text-red-400 bg-red-500/10 border-red-500/30' },
  rescue:   { icon: '🚨', label: 'Rescue',   color: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30' },
  shelter:  { icon: '🏠', label: 'Shelter',  color: 'text-purple-400 bg-purple-500/10 border-purple-500/30' },
  clothing: { icon: '👕', label: 'Clothing', color: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30' },
};

const URGENCY_COLORS = {
  low:      'text-green-400 bg-green-500/10 border-green-500/30',
  medium:   'text-yellow-400 bg-yellow-500/10 border-yellow-500/30',
  high:     'text-orange-400 bg-orange-500/10 border-orange-500/30',
  critical: 'text-red-400 bg-red-500/10 border-red-500/30',
};

const CitizenResources = () => {
  const { api } = useAuth();
  const [requests,     setRequests]     = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState(null);
  const [showModal,    setShowModal]    = useState(false);
  const [filterStatus, setFilterStatus] = useState('all');

  const fetchMyRequests = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get('/resources/mine');
      setRequests(data.requests || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load requests');
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => { fetchMyRequests(); }, [fetchMyRequests]);

  const filtered = filterStatus === 'all' ? requests : requests.filter(r => r.status === filterStatus);

  const pendingCount    = requests.filter(r => r.status === 'pending').length;
  const fulfilledCount  = requests.filter(r => r.status === 'fulfilled').length;

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black text-zinc-100">Resource Requests</h1>
          <p className="text-sm text-zinc-500 mt-0.5">{pendingCount} pending · {fulfilledCount} fulfilled</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchMyRequests}
            disabled={loading}
            className="p-2.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-xl transition"
          >
            <RefreshCw className={`w-4 h-4 text-zinc-400 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-semibold transition-all hover:scale-105 active:scale-95"
          >
            <Plus className="w-4 h-4" /> New Request
          </button>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1.5 p-1 bg-zinc-900 border border-zinc-800 rounded-xl">
        {[['all', 'All'], ['pending', 'Pending'], ['acknowledged', 'Acknowledged'], ['fulfilled', 'Fulfilled']].map(([val, label]) => (
          <button
            key={val}
            onClick={() => setFilterStatus(val)}
            className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              filterStatus === val ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {error && (
        <div className="flex items-center gap-2 p-4 bg-red-950/40 border border-red-800/40 rounded-xl text-red-400 text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2].map(i => (
            <div key={i} className="p-4 bg-zinc-900/80 border border-zinc-800/80 rounded-2xl animate-pulse space-y-2">
              <div className="h-4 bg-zinc-800 rounded w-1/2" />
              <div className="h-3 bg-zinc-800 rounded w-3/4" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-zinc-500">
          <Package className="w-10 h-10 mb-3 opacity-30" />
          <p className="text-sm font-semibold text-zinc-400">No requests yet</p>
          <p className="text-xs mt-1 text-center">Tap "New Request" to ask for help with food, water, medical aid, and more.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(req => {
            const typeInfo = TYPE_ICONS[req.type] || { icon: '📦', label: req.type, color: 'text-zinc-400 bg-zinc-700 border-zinc-600' };

            return (
              <div key={req._id} className="p-4 bg-zinc-900/80 border border-zinc-800/80 rounded-2xl hover:border-zinc-700 transition-all">
                <div className="flex items-start gap-3">
                  <span className="text-2xl shrink-0 mt-0.5">{typeInfo.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${typeInfo.color}`}>
                        {typeInfo.label}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${URGENCY_COLORS[req.urgency]}`}>
                          {req.urgency?.toUpperCase()}
                        </span>
                        {req.status === 'fulfilled' ? (
                          <span className="flex items-center gap-1 text-[10px] font-bold text-green-400 bg-green-500/10 border border-green-500/30 px-1.5 py-0.5 rounded-full">
                            <CheckCircle className="w-2.5 h-2.5" /> Fulfilled
                          </span>
                        ) : req.status === 'acknowledged' ? (
                          <span className="text-[10px] font-bold text-blue-400 bg-blue-500/10 border border-blue-500/30 px-1.5 py-0.5 rounded-full">
                            Acknowledged
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold text-zinc-400 bg-zinc-700/40 border border-zinc-600/40 px-1.5 py-0.5 rounded-full">
                            Pending
                          </span>
                        )}
                      </div>
                    </div>

                    {req.description && (
                      <p className="text-sm text-zinc-400 mt-1.5 leading-relaxed">{req.description}</p>
                    )}

                    <div className="flex items-center gap-3 mt-2 text-xs text-zinc-600">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(req.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {req.location?.address && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" /> {req.location.address}
                        </span>
                      )}
                    </div>

                    {req.status === 'fulfilled' && req.fulfilledBy && (
                      <p className="text-xs text-green-400/70 mt-1.5">
                        Fulfilled by <strong>{req.fulfilledBy.name}</strong> on {new Date(req.fulfilledAt).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showModal && (
        <ResourceRequestModal
          onClose={() => setShowModal(false)}
          onSuccess={() => { setShowModal(false); fetchMyRequests(); }}
        />
      )}
    </div>
  );
};

export default CitizenResources;
