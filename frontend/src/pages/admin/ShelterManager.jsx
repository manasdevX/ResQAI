import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  RefreshCw, Plus, AlertTriangle, Building2, MapPin, Phone,
  Users, Edit2, Trash2, X, CheckCircle, Save,
  Zap, Wifi, Heart, Baby, Accessibility, BedDouble, Droplets, UtensilsCrossed,
} from 'lucide-react';

const TYPE_OPTIONS = [
  { value: 'hospital',            label: 'Hospital' },
  { value: 'relief_camp',         label: 'Relief Camp' },
  { value: 'school',              label: 'School' },
  { value: 'community_hall',      label: 'Community Hall' },
  { value: 'government_building', label: 'Govt Building' },
  { value: 'warehouse',           label: 'Warehouse' },
  { value: 'other',               label: 'Other' },
];

const STATUS_OPTIONS = ['active', 'preparing', 'full', 'closed'];

const TYPE_ICONS = {
  hospital:'🏥', relief_camp:'⛺', school:'🏫',
  community_hall:'🏛️', government_building:'🏢', warehouse:'🏭', other:'📍',
};

const STATUS_COLORS = {
  active:    'bg-green-500/10 text-green-400 border-green-500/30',
  full:      'bg-red-500/10 text-red-400 border-red-500/30',
  preparing: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
  closed:    'bg-zinc-500/10 text-zinc-400 border-zinc-500/30',
};

const AMENITIES = [
  { key: 'food',                icon: UtensilsCrossed, label: 'Food' },
  { key: 'water',               icon: Droplets,        label: 'Water' },
  { key: 'medical',             icon: Heart,           label: 'Medical' },
  { key: 'electricity',         icon: Zap,             label: 'Power' },
  { key: 'wifi',                icon: Wifi,            label: 'WiFi' },
  { key: 'bedding',             icon: BedDouble,       label: 'Beds' },
  { key: 'childCare',           icon: Baby,            label: 'Child Care' },
  { key: 'wheelchairAccessible',icon: Accessibility,   label: 'Accessible' },
];

const OccupancyBar = ({ current, total, status }) => {
  const pct = total ? Math.min(100, Math.round((current / total) * 100)) : 0;
  const color = status === 'full' ? 'bg-red-500' : pct > 75 ? 'bg-orange-500' : pct > 50 ? 'bg-yellow-500' : 'bg-green-500';
  return (
    <div className="mt-2">
      <div className="flex justify-between text-[10px] text-zinc-500 mb-1">
        <span>{current}/{total}</span><span>{pct}%</span>
      </div>
      <div className="h-1 bg-zinc-700 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
};

const BLANK_FORM = {
  name: '', type: 'relief_camp', status: 'active',
  totalCapacity: '', currentOccupancy: '',
  location: { address: '', city: '', state: '', lat: '', lng: '' },
  amenities: { food: false, water: false, medical: false, electricity: false, wifi: false, bedding: false, childCare: false, wheelchairAccessible: false },
  contacts: [{ name: '', phone: '', role: '' }],
  notes: '',
};

const ShelterForm = ({ initial, onSave, onCancel, saving }) => {
  const [form, setForm] = useState(initial || BLANK_FORM);

  const set = (path, value) => {
    setForm(prev => {
      const next = structuredClone(prev);
      path.reduce((obj, key, i) => {
        if (i === path.length - 1) obj[key] = value;
        return obj[key];
      }, next);
      return next;
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const payload = {
      ...form,
      totalCapacity:    Number(form.totalCapacity),
      currentOccupancy: Number(form.currentOccupancy),
      location: {
        ...form.location,
        coordinates: form.location.lat && form.location.lng
          ? [parseFloat(form.location.lng), parseFloat(form.location.lat)]
          : undefined,
      },
    };
    onSave(payload);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5 block">Shelter Name *</label>
          <input required value={form.name} onChange={e => set(['name'], e.target.value)}
            placeholder="e.g. Rampur Relief Camp"
            className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-blue-500 transition" />
        </div>

        <div>
          <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5 block">Type</label>
          <select value={form.type} onChange={e => set(['type'], e.target.value)}
            className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-blue-500 transition">
            {TYPE_OPTIONS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>

        <div>
          <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5 block">Status</label>
          <select value={form.status} onChange={e => set(['status'], e.target.value)}
            className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-blue-500 transition">
            {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
          </select>
        </div>

        <div>
          <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5 block">Total Capacity *</label>
          <input required type="number" min={0} value={form.totalCapacity} onChange={e => set(['totalCapacity'], e.target.value)}
            placeholder="500"
            className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-blue-500 transition" />
        </div>

        <div>
          <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5 block">Current Occupancy</label>
          <input type="number" min={0} value={form.currentOccupancy} onChange={e => set(['currentOccupancy'], e.target.value)}
            placeholder="0"
            className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-blue-500 transition" />
        </div>
      </div>

      {/* Location */}
      <div>
        <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2 block">Location</label>
        <div className="grid grid-cols-2 gap-2">
          <input value={form.location.address} onChange={e => set(['location','address'], e.target.value)}
            placeholder="Street address" className="col-span-2 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-blue-500 transition" />
          <input value={form.location.city} onChange={e => set(['location','city'], e.target.value)}
            placeholder="City" className="px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-blue-500 transition" />
          <input value={form.location.state} onChange={e => set(['location','state'], e.target.value)}
            placeholder="State" className="px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-blue-500 transition" />
          <input value={form.location.lat} onChange={e => set(['location','lat'], e.target.value)}
            placeholder="Latitude" className="px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-blue-500 transition" />
          <input value={form.location.lng} onChange={e => set(['location','lng'], e.target.value)}
            placeholder="Longitude" className="px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-blue-500 transition" />
        </div>
      </div>

      {/* Amenities */}
      <div>
        <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2 block">Amenities</label>
        <div className="flex flex-wrap gap-2">
          {AMENITIES.map(({ key, icon: Icon, label }) => (
            <button key={key} type="button"
              onClick={() => set(['amenities', key], !form.amenities[key])}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition ${
                form.amenities[key]
                  ? 'bg-blue-600/20 border-blue-600/40 text-blue-400'
                  : 'bg-zinc-800 border-zinc-700 text-zinc-500 hover:border-zinc-600'
              }`}>
              <Icon className="w-3 h-3" /> {label}
            </button>
          ))}
        </div>
      </div>

      {/* Contact */}
      <div>
        <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2 block">Primary Contact</label>
        <div className="grid grid-cols-3 gap-2">
          <input value={form.contacts[0]?.name || ''} onChange={e => set(['contacts', 0, 'name'], e.target.value)}
            placeholder="Name" className="px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-blue-500 transition" />
          <input value={form.contacts[0]?.phone || ''} onChange={e => set(['contacts', 0, 'phone'], e.target.value)}
            placeholder="Phone" className="px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-blue-500 transition" />
          <input value={form.contacts[0]?.role || ''} onChange={e => set(['contacts', 0, 'role'], e.target.value)}
            placeholder="Role (e.g. Manager)" className="px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-blue-500 transition" />
        </div>
      </div>

      {/* Notes */}
      <div>
        <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5 block">Notes</label>
        <textarea value={form.notes} onChange={e => set(['notes'], e.target.value)}
          rows={2} placeholder="Additional information…"
          className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-blue-500 transition resize-none" />
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        <button type="button" onClick={onCancel}
          className="flex-1 py-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg text-sm font-medium text-zinc-300 transition">
          Cancel
        </button>
        <button type="submit" disabled={saving}
          className="flex-1 flex items-center justify-center gap-2 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg text-sm font-semibold transition">
          {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? 'Saving…' : 'Save Shelter'}
        </button>
      </div>
    </form>
  );
};

const AdminShelterManager = () => {
  const { api } = useAuth();

  const [shelters,    setShelters]    = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState(null);
  const [success,     setSuccess]     = useState('');
  const [mode,        setMode]        = useState(null); // null | 'create' | 'edit'
  const [editing,     setEditing]     = useState(null);
  const [saving,      setSaving]      = useState(false);
  const [deleting,    setDeleting]    = useState(null);
  const [filterStatus,setFilterStatus]= useState('all');
  const [updatingOcc, setUpdatingOcc] = useState(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get('/shelters');
      setShelters(data.shelters || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load shelters');
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => { fetch(); }, [fetch]);

  const showSuccess = (msg) => { setSuccess(msg); setTimeout(() => setSuccess(''), 3500); };

  const handleSave = async (payload) => {
    setSaving(true);
    setError(null);
    try {
      if (mode === 'create') {
        const { data } = await api.post('/shelters', payload);
        setShelters(prev => [data.shelter, ...prev]);
        showSuccess('Shelter created successfully.');
      } else {
        const { data } = await api.put(`/shelters/${editing._id}`, payload);
        setShelters(prev => prev.map(s => s._id === editing._id ? data.shelter : s));
        showSuccess('Shelter updated successfully.');
      }
      setMode(null);
      setEditing(null);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save shelter');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this shelter? This cannot be undone.')) return;
    setDeleting(id);
    try {
      await api.delete(`/shelters/${id}`);
      setShelters(prev => prev.filter(s => s._id !== id));
      showSuccess('Shelter deleted.');
      if (editing?._id === id) { setMode(null); setEditing(null); }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete shelter');
    } finally {
      setDeleting(null);
    }
  };

  const handleOccupancyUpdate = async (shelter, delta) => {
    const newOcc = Math.max(0, Math.min(shelter.totalCapacity, (shelter.currentOccupancy || 0) + delta));
    setUpdatingOcc(shelter._id);
    try {
      const { data } = await api.patch(`/shelters/${shelter._id}/occupancy`, { currentOccupancy: newOcc });
      setShelters(prev => prev.map(s => s._id === shelter._id ? data.shelter : s));
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update occupancy');
    } finally {
      setUpdatingOcc(null);
    }
  };

  const displayed = filterStatus === 'all' ? shelters : shelters.filter(s => s.status === filterStatus);

  const totalCapacity   = shelters.reduce((a, s) => a + (s.totalCapacity || 0), 0);
  const totalOccupancy  = shelters.reduce((a, s) => a + (s.currentOccupancy || 0), 0);
  const activeCount     = shelters.filter(s => s.status === 'active').length;

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-zinc-800 bg-zinc-900/50 shrink-0">
        <div className="flex items-center justify-between gap-4 mb-4">
          <div>
            <h1 className="text-lg font-black text-zinc-100">Shelter Manager</h1>
            <p className="text-xs text-zinc-500 mt-0.5">Create, edit and track shelter occupancy</p>
          </div>
          <div className="flex gap-2">
            <button onClick={fetch} disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg text-xs font-medium text-zinc-300 transition">
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </button>
            <button onClick={() => { setEditing(null); setMode('create'); }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded-lg text-xs font-semibold text-white transition">
              <Plus className="w-3.5 h-3.5" /> Add Shelter
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Total Shelters', value: shelters.length, sub: `${activeCount} active` },
            { label: 'Total Capacity', value: totalCapacity.toLocaleString(), sub: 'beds/spaces' },
            { label: 'Current Occupancy', value: `${totalCapacity ? Math.round((totalOccupancy/totalCapacity)*100) : 0}%`, sub: `${totalOccupancy.toLocaleString()} people` },
          ].map(({ label, value, sub }) => (
            <div key={label} className="bg-zinc-800/60 border border-zinc-700/50 rounded-xl p-3">
              <p className="text-lg font-black text-zinc-100">{value}</p>
              <p className="text-xs font-semibold text-zinc-400">{label}</p>
              <p className="text-[10px] text-zinc-600">{sub}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Alerts */}
      {(error || success) && (
        <div className={`mx-6 mt-4 flex items-center gap-2 p-3 rounded-xl text-sm ${error ? 'bg-red-950/40 border border-red-800/40 text-red-400' : 'bg-green-950/40 border border-green-700/40 text-green-400'}`}>
          {error ? <AlertTriangle className="w-4 h-4 shrink-0" /> : <CheckCircle className="w-4 h-4 shrink-0" />}
          {error || success}
          {error && <button onClick={() => setError(null)} className="ml-auto"><X className="w-4 h-4" /></button>}
        </div>
      )}

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Status filter */}
          <div className="flex gap-1.5">
            {['all', ...STATUS_OPTIONS].map(s => (
              <button key={s} onClick={() => setFilterStatus(s)}
                className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition capitalize ${filterStatus === s ? 'bg-blue-600 border-blue-500 text-white' : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-600'}`}>
                {s === 'all' ? `All (${shelters.length})` : `${s} (${shelters.filter(x => x.status === s).length})`}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              {[1,2,3].map(i => (
                <div key={i} className="p-4 bg-zinc-900 border border-zinc-800 rounded-2xl animate-pulse space-y-3">
                  <div className="h-4 bg-zinc-800 rounded w-3/4" />
                  <div className="h-3 bg-zinc-800 rounded w-1/2" />
                  <div className="h-2 bg-zinc-800 rounded-full" />
                </div>
              ))}
            </div>
          ) : displayed.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-zinc-500">
              <Building2 className="w-10 h-10 mb-3 opacity-30" />
              <p className="text-sm font-semibold text-zinc-400">No shelters found</p>
              <button onClick={() => setMode('create')} className="mt-3 text-xs text-blue-400 hover:underline">+ Add your first shelter</button>
            </div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              {displayed.map(s => (
                <div key={s._id} className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden hover:border-zinc-700 transition-all">
                  <div className={`h-0.5 w-full ${s.status === 'active' ? 'bg-green-500' : s.status === 'full' ? 'bg-red-500' : s.status === 'preparing' ? 'bg-blue-500' : 'bg-zinc-600'}`} />
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-start gap-2.5 min-w-0">
                        <span className="text-xl shrink-0">{TYPE_ICONS[s.type] || '📍'}</span>
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-zinc-100 leading-tight truncate">{s.name}</p>
                          <p className="text-xs text-zinc-500 mt-0.5 flex items-center gap-1">
                            <MapPin className="w-2.5 h-2.5 shrink-0" />{s.location?.city}, {s.location?.state}
                          </p>
                        </div>
                      </div>
                      <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase ${STATUS_COLORS[s.status]}`}>{s.status}</span>
                    </div>

                    <OccupancyBar current={s.currentOccupancy || 0} total={s.totalCapacity || 0} status={s.status} />

                    {/* Quick occupancy controls */}
                    <div className="flex items-center gap-2 mt-3">
                      <button onClick={() => handleOccupancyUpdate(s, -10)} disabled={updatingOcc === s._id || (s.currentOccupancy || 0) <= 0}
                        className="px-2 py-1 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg text-xs font-bold text-zinc-300 transition disabled:opacity-40">-10</button>
                      <span className="text-xs text-zinc-500 flex-1 text-center">
                        {updatingOcc === s._id ? <RefreshCw className="w-3 h-3 animate-spin inline" /> : `${s.currentOccupancy || 0} / ${s.totalCapacity || 0}`}
                      </span>
                      <button onClick={() => handleOccupancyUpdate(s, 10)} disabled={updatingOcc === s._id || (s.currentOccupancy || 0) >= s.totalCapacity}
                        className="px-2 py-1 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg text-xs font-bold text-zinc-300 transition disabled:opacity-40">+10</button>
                    </div>

                    {/* Amenities */}
                    <div className="flex flex-wrap gap-1 mt-2.5">
                      {AMENITIES.filter(a => s.amenities?.[a.key]).map(({ key, icon: Icon, label }) => (
                        <span key={key} className="flex items-center gap-1 text-[10px] text-zinc-400 bg-zinc-800 border border-zinc-700 px-1.5 py-0.5 rounded-md">
                          <Icon className="w-2.5 h-2.5" /> {label}
                        </span>
                      ))}
                    </div>

                    {/* Contact */}
                    {s.contacts?.[0]?.phone && (
                      <div className="flex items-center justify-between mt-3 pt-3 border-t border-zinc-800">
                        <span className="text-xs text-zinc-500">{s.contacts[0].name} · {s.contacts[0].role}</span>
                        <a href={`tel:${s.contacts[0].phone}`}
                          className="flex items-center gap-1 text-xs text-green-400 bg-green-500/10 border border-green-500/20 px-2 py-0.5 rounded-lg hover:bg-green-500/20 transition">
                          <Phone className="w-2.5 h-2.5" /> {s.contacts[0].phone}
                        </a>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-2 mt-3 pt-3 border-t border-zinc-800">
                      <button onClick={() => { setEditing(s); setMode('edit'); }}
                        className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg text-xs font-medium text-zinc-300 transition">
                        <Edit2 className="w-3 h-3" /> Edit
                      </button>
                      <button onClick={() => handleDelete(s._id)} disabled={deleting === s._id}
                        className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-red-950/30 hover:bg-red-950/50 border border-red-800/30 rounded-lg text-xs font-medium text-red-400 transition disabled:opacity-50">
                        {deleting === s._id ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Create/Edit panel */}
        {mode && (
          <div className="w-[400px] xl:w-[440px] shrink-0 border-l border-zinc-800 overflow-y-auto p-6 bg-zinc-900/30">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-sm font-bold text-zinc-100">
                {mode === 'create' ? '+ New Shelter' : `Edit: ${editing?.name}`}
              </h2>
              <button onClick={() => { setMode(null); setEditing(null); }} className="p-1 hover:bg-zinc-800 rounded-lg transition">
                <X className="w-4 h-4 text-zinc-500" />
              </button>
            </div>
            <ShelterForm
              initial={editing ? {
                ...editing,
                location: {
                  ...editing.location,
                  lat: editing.location?.coordinates?.[1] || '',
                  lng: editing.location?.coordinates?.[0] || '',
                },
                contacts: editing.contacts?.length ? editing.contacts : [{ name: '', phone: '', role: '' }],
              } : undefined}
              onSave={handleSave}
              onCancel={() => { setMode(null); setEditing(null); }}
              saving={saving}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminShelterManager;
