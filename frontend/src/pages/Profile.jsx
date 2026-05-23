import { useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { Camera, Save, Loader2, CheckCircle, AlertTriangle, User, Mail, Phone, Shield, Calendar, Lock, Eye, EyeOff } from 'lucide-react';

const ROLE_BADGE = {
  admin:           { label: 'Admin',           bg: 'bg-red-500/15 text-red-400 border-red-500/30' },
  responder:       { label: 'Responder',       bg: 'bg-blue-500/15 text-blue-400 border-blue-500/30' },
  shelter_manager: { label: 'Shelter Manager', bg: 'bg-purple-500/15 text-purple-400 border-purple-500/30' },
  citizen:         { label: 'Citizen',         bg: 'bg-green-500/15 text-green-400 border-green-500/30' },
};

const Profile = () => {
  const { user, api, updateUser } = useAuth();

  const [name,            setName]            = useState(user?.name  || '');
  const [phone,           setPhone]           = useState(user?.phone || '');
  const [saving,          setSaving]          = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [message,         setMessage]         = useState(null); // { type, text }

  // Password change state
  const [currentPassword,  setCurrentPassword]  = useState('');
  const [newPassword,      setNewPassword]      = useState('');
  const [confirmPassword,  setConfirmPassword]  = useState('');
  const [showCurrent,      setShowCurrent]      = useState(false);
  const [showNew,          setShowNew]          = useState(false);
  const [showConfirm,      setShowConfirm]      = useState(false);
  const [pwSaving,         setPwSaving]         = useState(false);
  const [pwMessage,        setPwMessage]        = useState(null); // { type, text }

  const fileInputRef = useRef(null);

  const showMsg = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 4000);
  };

  const showPwMsg = (type, text) => {
    setPwMessage({ type, text });
    setTimeout(() => setPwMessage(null), 4000);
  };

  const pwStrength = (p) => {
    let score = 0;
    if (p.length >= 8)                                            score++;
    if (/[A-Z]/.test(p))                                         score++;
    if (/[a-z]/.test(p))                                         score++;
    if (/\d/.test(p))                                            score++;
    if (/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?~`]/.test(p))       score++;
    return score; // 0-5
  };

  const handleChangePassword = async () => {
    if (!currentPassword) { showPwMsg('error', 'Enter your current password'); return; }
    if (!newPassword)      { showPwMsg('error', 'Enter a new password'); return; }
    if (pwStrength(newPassword) < 5) {
      showPwMsg('error', 'New password must be 8+ characters with uppercase, lowercase, number, and special character');
      return;
    }
    if (newPassword !== confirmPassword) { showPwMsg('error', 'Passwords do not match'); return; }

    setPwSaving(true);
    try {
      const { data } = await api.patch('/users/password', { currentPassword, newPassword });
      showPwMsg('success', data.message || 'Password changed successfully');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      showPwMsg('error', err.response?.data?.message || 'Failed to change password');
    } finally {
      setPwSaving(false);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) { showMsg('error', 'Name cannot be empty'); return; }
    setSaving(true);
    try {
      const { data } = await api.patch('/users/profile', { name: name.trim(), phone: phone.trim() || undefined });
      updateUser({ name: data.user.name, phone: data.user.phone });
      showMsg('success', 'Profile saved successfully');
    } catch (err) {
      showMsg('error', err.response?.data?.message || 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { showMsg('error', 'Please select an image file'); return; }
    if (file.size > 2 * 1024 * 1024)    { showMsg('error', 'Image must be under 2 MB'); return; }

    setAvatarUploading(true);
    try {
      const form = new FormData();
      form.append('avatar', file);
      const { data } = await api.patch('/users/avatar', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      updateUser({ avatar: data.avatar });
      showMsg('success', 'Avatar updated');
    } catch (err) {
      showMsg('error', err.response?.data?.message || 'Failed to upload avatar');
    } finally {
      setAvatarUploading(false);
      e.target.value = '';
    }
  };

  const roleBadge = ROLE_BADGE[user?.role] || ROLE_BADGE.citizen;
  const initials  = user?.name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '?';

  const hasChanges = name.trim() !== (user?.name || '') || phone.trim() !== (user?.phone || '');

  return (
    <div className="max-w-xl mx-auto px-4 py-8 space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-xl font-black text-zinc-100">My Profile</h1>
        <p className="text-sm text-zinc-500 mt-0.5">Update your name, phone number and avatar</p>
      </div>

      {/* Feedback banner */}
      {message && (
        <div className={`flex items-center gap-2.5 p-3.5 rounded-xl border text-sm font-medium ${
          message.type === 'success'
            ? 'bg-green-950/40 border-green-700/40 text-green-400'
            : 'bg-red-950/40 border-red-700/40 text-red-400'
        }`}>
          {message.type === 'success'
            ? <CheckCircle className="w-4 h-4 shrink-0" />
            : <AlertTriangle className="w-4 h-4 shrink-0" />}
          {message.text}
        </div>
      )}

      {/* Avatar card */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
        <div className="flex items-center gap-5">
          <div className="relative shrink-0">
            <div className="w-20 h-20 rounded-full overflow-hidden bg-zinc-700 flex items-center justify-center border-2 border-zinc-600">
              {user?.avatar ? (
                <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
              ) : (
                <span className="text-2xl font-black text-zinc-300">{initials}</span>
              )}
            </div>
            {avatarUploading && (
              <div className="absolute inset-0 rounded-full bg-zinc-900/70 flex items-center justify-center">
                <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
              </div>
            )}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={avatarUploading}
              className="absolute -bottom-1 -right-1 w-7 h-7 bg-blue-600 hover:bg-blue-500 rounded-full flex items-center justify-center border-2 border-zinc-900 transition disabled:opacity-50"
              title="Change avatar"
            >
              <Camera className="w-3.5 h-3.5 text-white" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarSelect}
            />
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-base font-bold text-zinc-100 truncate">{user?.name}</p>
            <p className="text-sm text-zinc-500 truncate">{user?.email}</p>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${roleBadge.bg}`}>
                {roleBadge.label}
              </span>
              {user?.createdAt && (
                <span className="flex items-center gap-1 text-[11px] text-zinc-600">
                  <Calendar className="w-3 h-3" />
                  Joined {new Date(user.createdAt).toLocaleDateString('en', { month: 'short', year: 'numeric' })}
                </span>
              )}
            </div>
          </div>
        </div>
        <p className="text-[11px] text-zinc-600 mt-3">Click the camera icon to upload a new photo (max 2 MB, images only).</p>
      </div>

      {/* Editable fields */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-4">
        <h2 className="text-sm font-bold text-zinc-200">Personal Information</h2>

        {/* Name */}
        <div>
          <label className="block text-xs font-semibold text-zinc-400 mb-1.5 flex items-center gap-1.5">
            <User className="w-3.5 h-3.5" /> Full Name
          </label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            maxLength={100}
            placeholder="Your full name"
            className="w-full px-3.5 py-2.5 bg-zinc-800 border border-zinc-700 rounded-xl text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition"
          />
        </div>

        {/* Email — read-only */}
        <div>
          <label className="block text-xs font-semibold text-zinc-400 mb-1.5 flex items-center gap-1.5">
            <Mail className="w-3.5 h-3.5" /> Email Address
          </label>
          <div className="flex items-center gap-2">
            <input
              type="email"
              value={user?.email || ''}
              readOnly
              className="flex-1 px-3.5 py-2.5 bg-zinc-800/50 border border-zinc-700/50 rounded-xl text-sm text-zinc-500 cursor-not-allowed"
            />
            <span className="shrink-0 text-[10px] font-semibold px-2 py-1 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-500">
              Cannot change
            </span>
          </div>
        </div>

        {/* Phone */}
        <div>
          <label className="block text-xs font-semibold text-zinc-400 mb-1.5 flex items-center gap-1.5">
            <Phone className="w-3.5 h-3.5" /> Phone Number <span className="text-zinc-600 font-normal">(optional)</span>
          </label>
          <input
            type="tel"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            placeholder="+91 98765 43210"
            className="w-full px-3.5 py-2.5 bg-zinc-800 border border-zinc-700 rounded-xl text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition"
          />
          <p className="text-[11px] text-zinc-600 mt-1">Used by responders to contact you during emergencies.</p>
        </div>

        {/* Role (read-only info) */}
        <div>
          <label className="block text-xs font-semibold text-zinc-400 mb-1.5 flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5" /> Role
          </label>
          <div className="px-3.5 py-2.5 bg-zinc-800/50 border border-zinc-700/50 rounded-xl">
            <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${roleBadge.bg}`}>
              {roleBadge.label}
            </span>
            <span className="text-xs text-zinc-600 ml-3">Contact an admin to change your role.</span>
          </div>
        </div>

        {/* Save button */}
        <button
          onClick={handleSave}
          disabled={saving || !hasChanges}
          className="w-full flex items-center justify-center gap-2 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition"
        >
          {saving
            ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>
            : <><Save className="w-4 h-4" /> Save Changes</>}
        </button>
      </div>

      {/* Security card */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-4">
        <h2 className="text-sm font-bold text-zinc-200 flex items-center gap-2">
          <Lock className="w-4 h-4 text-zinc-500" /> Change Password
        </h2>

        {pwMessage && (
          <div className={`flex items-center gap-2.5 p-3 rounded-xl border text-xs font-medium ${
            pwMessage.type === 'success'
              ? 'bg-green-950/40 border-green-700/40 text-green-400'
              : 'bg-red-950/40 border-red-700/40 text-red-400'
          }`}>
            {pwMessage.type === 'success'
              ? <CheckCircle className="w-3.5 h-3.5 shrink-0" />
              : <AlertTriangle className="w-3.5 h-3.5 shrink-0" />}
            {pwMessage.text}
          </div>
        )}

        {/* Current password */}
        <div>
          <label className="block text-xs font-semibold text-zinc-400 mb-1.5">Current Password</label>
          <div className="relative">
            <input
              type={showCurrent ? 'text' : 'password'}
              value={currentPassword}
              onChange={e => setCurrentPassword(e.target.value)}
              placeholder="Your current password"
              className="w-full px-3.5 py-2.5 pr-10 bg-zinc-800 border border-zinc-700 rounded-xl text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition"
            />
            <button
              type="button"
              onClick={() => setShowCurrent(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition"
            >
              {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* New password */}
        <div>
          <label className="block text-xs font-semibold text-zinc-400 mb-1.5">New Password</label>
          <div className="relative">
            <input
              type={showNew ? 'text' : 'password'}
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              placeholder="At least 8 chars, upper, lower, number, symbol"
              className="w-full px-3.5 py-2.5 pr-10 bg-zinc-800 border border-zinc-700 rounded-xl text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition"
            />
            <button
              type="button"
              onClick={() => setShowNew(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition"
            >
              {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {/* Strength bar */}
          {newPassword && (() => {
            const s = pwStrength(newPassword);
            const bars  = [
              'bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-lime-500', 'bg-green-500',
            ];
            const labels = ['Very weak', 'Weak', 'Fair', 'Good', 'Strong'];
            return (
              <div className="mt-2 space-y-1">
                <div className="flex gap-1">
                  {[0,1,2,3,4].map(i => (
                    <div key={i} className={`h-1 flex-1 rounded-full transition-all ${i < s ? bars[s - 1] : 'bg-zinc-700'}`} />
                  ))}
                </div>
                <p className={`text-[10px] font-semibold ${s <= 1 ? 'text-red-400' : s <= 2 ? 'text-orange-400' : s <= 3 ? 'text-yellow-400' : s <= 4 ? 'text-lime-400' : 'text-green-400'}`}>
                  {labels[s - 1] || 'Very weak'}
                </p>
              </div>
            );
          })()}
        </div>

        {/* Confirm new password */}
        <div>
          <label className="block text-xs font-semibold text-zinc-400 mb-1.5">Confirm New Password</label>
          <div className="relative">
            <input
              type={showConfirm ? 'text' : 'password'}
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              placeholder="Repeat new password"
              className={`w-full px-3.5 py-2.5 pr-10 bg-zinc-800 border rounded-xl text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-1 transition ${
                confirmPassword && confirmPassword !== newPassword
                  ? 'border-red-500 focus:border-red-500 focus:ring-red-500/30'
                  : 'border-zinc-700 focus:border-blue-500 focus:ring-blue-500/30'
              }`}
            />
            <button
              type="button"
              onClick={() => setShowConfirm(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition"
            >
              {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {confirmPassword && confirmPassword !== newPassword && (
            <p className="text-[11px] text-red-400 mt-1">Passwords do not match</p>
          )}
        </div>

        <button
          onClick={handleChangePassword}
          disabled={pwSaving || !currentPassword || !newPassword || !confirmPassword}
          className="w-full flex items-center justify-center gap-2 py-2.5 bg-zinc-700 hover:bg-zinc-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition"
        >
          {pwSaving
            ? <><Loader2 className="w-4 h-4 animate-spin" /> Updating…</>
            : <><Lock className="w-4 h-4" /> Update Password</>}
        </button>
      </div>
    </div>
  );
};

export default Profile;
