import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  Link2, Plus, RefreshCw, AlertTriangle, CheckCircle,
  Copy, Trash2, Clock, Mail, Shield, X,
} from 'lucide-react';

const ROLE_STYLES = {
  admin:           { label: 'Admin',           color: 'text-red-400 bg-red-500/10 border-red-500/30' },
  shelter_manager: { label: 'Shelter Manager', color: 'text-purple-400 bg-purple-500/10 border-purple-500/30' },
};

const AdminInvites = () => {
  const { api } = useAuth();

  const [invites,   setInvites]   = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);
  const [success,   setSuccess]   = useState('');
  const [creating,  setCreating]  = useState(false);
  const [deleting,  setDeleting]  = useState(null);
  const [copiedId,  setCopiedId]  = useState(null);
  const [showForm,  setShowForm]  = useState(false);

  const [formEmail, setFormEmail] = useState('');
  const [formRole,  setFormRole]  = useState('admin');

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get('/invites');
      setInvites(data.invites || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load invites');
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => { fetch(); }, [fetch]);

  const showSuccessMsg = (msg) => { setSuccess(msg); setTimeout(() => setSuccess(''), 4000); };

  const handleCreate = async (e) => {
    e.preventDefault();
    setCreating(true);
    setError(null);
    try {
      const { data } = await api.post('/invites', { email: formEmail || undefined, role: formRole });
      setInvites(prev => [data.invite, ...prev]);
      setFormEmail('');
      setShowForm(false);
      showSuccessMsg('Invite link created. Share it with the recipient.');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create invite');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Revoke this invite link?')) return;
    setDeleting(id);
    try {
      await api.delete(`/invites/${id}`);
      setInvites(prev => prev.filter(inv => inv._id !== id));
      showSuccessMsg('Invite revoked.');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to revoke invite');
    } finally {
      setDeleting(null);
    }
  };

  const handleCopy = async (invite) => {
    const link = `${window.location.origin}/signup?invite=${invite.token}`;
    try {
      await navigator.clipboard.writeText(link);
      setCopiedId(invite._id);
      setTimeout(() => setCopiedId(null), 2500);
    } catch {
      setError('Failed to copy link — try selecting and copying the link manually');
    }
  };

  const isExpired = (invite) => !invite.usedAt && new Date(invite.expiresAt) < new Date();
  const isUsed    = (invite) => !!invite.usedAt;

  const unusedCount = invites.filter(i => !isUsed(i) && !isExpired(i)).length;

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-black text-zinc-100">Invite Links</h1>
          <p className="text-xs text-zinc-500 mt-0.5">
            Generate invite-only access links for admins and shelter managers
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={fetch} disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg text-xs font-medium text-zinc-300 transition">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
          <button onClick={() => setShowForm(f => !f)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded-lg text-xs font-semibold text-white transition">
            <Plus className="w-3.5 h-3.5" /> New Invite
          </button>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-950/40 border border-red-800/40 rounded-xl text-red-400 text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
          <button onClick={() => setError(null)} className="ml-auto"><X className="w-4 h-4" /></button>
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 p-3 bg-green-950/40 border border-green-700/40 rounded-xl text-green-400 text-sm">
          <CheckCircle className="w-4 h-4 shrink-0" /> {success}
        </div>
      )}

      {/* Create form */}
      {showForm && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
              <Shield className="w-4 h-4 text-blue-400" /> Create Invite Link
            </h2>
            <button onClick={() => setShowForm(false)} className="p-1 hover:bg-zinc-800 rounded-lg transition">
              <X className="w-4 h-4 text-zinc-500" />
            </button>
          </div>

          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5 block">
                Recipient Email <span className="text-zinc-600 font-normal normal-case">(optional — locks the invite to this email)</span>
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500 pointer-events-none" />
                <input
                  type="email"
                  value={formEmail}
                  onChange={e => setFormEmail(e.target.value)}
                  placeholder="someone@example.com"
                  className="w-full pl-9 pr-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-xl text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-blue-500 transition"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2 block">Grant Role</label>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(ROLE_STYLES).map(([role, { label, color }]) => (
                  <button
                    key={role}
                    type="button"
                    onClick={() => setFormRole(role)}
                    className={`p-3 rounded-xl border text-sm font-semibold transition ${
                      formRole === role ? color : 'border-zinc-700 bg-zinc-800/40 text-zinc-400 hover:border-zinc-600'
                    }`}
                  >
                    {role === 'admin' ? '⚙️' : '🏠'} {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-3 bg-zinc-800/50 border border-zinc-700/50 rounded-xl text-xs text-zinc-500">
              <p>The generated link will expire in <strong className="text-zinc-300">48 hours</strong> and can only be used once. The recipient registers via the link and receives the selected role automatically.</p>
            </div>

            <button type="submit" disabled={creating}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl font-semibold text-sm transition">
              {creating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
              {creating ? 'Generating…' : 'Generate Invite Link'}
            </button>
          </form>
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Active Invites',  value: unusedCount,                                    color: 'text-blue-400' },
          { label: 'Used',            value: invites.filter(i => isUsed(i)).length,          color: 'text-green-400' },
          { label: 'Expired',         value: invites.filter(i => isExpired(i)).length,       color: 'text-zinc-500' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-center">
            <p className={`text-xl font-black ${color}`}>{value}</p>
            <p className="text-[10px] text-zinc-500 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => (
            <div key={i} className="p-4 bg-zinc-900 border border-zinc-800 rounded-2xl animate-pulse space-y-2">
              <div className="h-4 bg-zinc-800 rounded w-1/2" />
              <div className="h-3 bg-zinc-800 rounded w-3/4" />
            </div>
          ))}
        </div>
      ) : invites.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-zinc-500">
          <Link2 className="w-10 h-10 mb-3 opacity-30" />
          <p className="text-sm font-semibold text-zinc-400">No invites yet</p>
          <p className="text-xs mt-1">Create your first invite to onboard admins or shelter managers</p>
        </div>
      ) : (
        <div className="space-y-3">
          {invites.map(invite => {
            const used    = isUsed(invite);
            const expired = isExpired(invite);
            const roleStyle = ROLE_STYLES[invite.role] || { label: invite.role, color: 'text-zinc-400 bg-zinc-700 border-zinc-600' };
            const link = `${window.location.origin}/signup?invite=${invite.token}`;

            return (
              <div key={invite._id}
                className={`bg-zinc-900 border rounded-2xl p-4 transition ${used ? 'opacity-60 border-zinc-700/50' : expired ? 'opacity-50 border-zinc-700/40' : 'border-zinc-800 hover:border-zinc-700'}`}>
                <div className="flex items-start gap-3">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${used ? 'bg-green-500/10' : expired ? 'bg-zinc-700/30' : 'bg-blue-500/10'}`}>
                    {used ? <CheckCircle className="w-4 h-4 text-green-400" /> : expired ? <Clock className="w-4 h-4 text-zinc-500" /> : <Link2 className="w-4 h-4 text-blue-400" />}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${roleStyle.color}`}>
                        {roleStyle.label}
                      </span>
                      {used    && <span className="text-xs font-semibold text-green-400">✓ Used</span>}
                      {expired && !used && <span className="text-xs font-semibold text-zinc-500">Expired</span>}
                      {!used && !expired && <span className="text-xs font-semibold text-blue-400">Active</span>}
                    </div>

                    {invite.email && (
                      <p className="text-xs text-zinc-400 flex items-center gap-1 mb-1">
                        <Mail className="w-3 h-3 shrink-0" /> {invite.email}
                      </p>
                    )}

                    <p className="text-[11px] font-mono text-zinc-600 bg-zinc-800 px-2 py-1 rounded-lg truncate" title={link}>
                      …/signup?invite={invite.token.slice(0, 16)}…
                    </p>

                    <div className="flex items-center gap-3 mt-2 text-[10px] text-zinc-600">
                      <span className="flex items-center gap-1">
                        <Clock className="w-2.5 h-2.5" />
                        Created {new Date(invite.createdAt).toLocaleDateString()}
                      </span>
                      <span>
                        {used ? `Used on ${new Date(invite.usedAt).toLocaleDateString()}` : `Expires ${new Date(invite.expiresAt).toLocaleDateString()}`}
                      </span>
                      {invite.createdBy?.name && <span>by {invite.createdBy.name}</span>}
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5 shrink-0">
                    {!used && !expired && (
                      <button
                        onClick={() => handleCopy(invite)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                          copiedId === invite._id
                            ? 'bg-green-600/20 border-green-600/30 text-green-400'
                            : 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700'
                        }`}
                      >
                        {copiedId === invite._id ? <CheckCircle className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                        {copiedId === invite._id ? 'Copied!' : 'Copy Link'}
                      </button>
                    )}

                    {!used && (
                      <button
                        onClick={() => handleDelete(invite._id)}
                        disabled={deleting === invite._id}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border bg-red-950/20 border-red-800/30 text-red-400 hover:bg-red-950/40 transition disabled:opacity-50"
                      >
                        {deleting === invite._id ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                        Revoke
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AdminInvites;
