import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Loader2, Mail, Lock, User, Phone, AlertTriangle, Eye, EyeOff, CheckCircle, ShieldCheck } from 'lucide-react';
import { useGoogleLogin } from '@react-oauth/google';
import axios from 'axios';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const Signup = () => {
  const [name,         setName]         = useState('');
  const [email,        setEmail]        = useState('');
  const [phone,        setPhone]        = useState('');
  const [password,     setPassword]     = useState('');
  const [showPwd,      setShowPwd]      = useState(false);
  const [role,         setRole]         = useState('citizen');
  const [error,        setError]        = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [inviteData,   setInviteData]   = useState(null); // { role, email } from invite token
  const [inviteValid,  setInviteValid]  = useState(null); // null=checking, true=valid, false=invalid

  const { signup, googleLogin, roleHome } = useAuth();
  const navigate     = useNavigate();
  const [params]     = useSearchParams();
  const inviteToken  = params.get('invite');

  const redirect = (r) => navigate(roleHome(r), { replace: true });

  // Validate invite token on mount
  useEffect(() => {
    if (!inviteToken) return;
    (async () => {
      try {
        const { data } = await axios.get(`${API}/invites/validate?token=${inviteToken}`);
        if (data.valid) {
          setInviteData({ role: data.role, email: data.email });
          setInviteValid(true);
          if (data.email) setEmail(data.email);
        } else {
          setInviteValid(false);
        }
      } catch {
        setInviteValid(false);
      }
    })();
  }, [inviteToken]);

  const handleGoogleSuccess = async (tokenResponse) => {
    setIsSubmitting(true);
    setError('');
    try {
      const data = await googleLogin(tokenResponse.access_token, inviteData?.role || role);
      redirect(data.role);
    } catch (err) {
      setError(err.response?.data?.message || 'Google Sign-Up failed');
      setIsSubmitting(false);
    }
  };

  const signupWithGoogle = useGoogleLogin({
    onSuccess: handleGoogleSuccess,
    onError:   () => setError('Google Sign-Up was unsuccessful. Try again.'),
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!name.trim())  { setError('Full name is required'); return; }
    if (!email.trim()) { setError('Email is required'); return; }
    if (password.length < 8) { setError('Password must be at least 8 characters'); return; }
    setIsSubmitting(true);
    try {
      const assignedRole = inviteData?.role || role;
      const data = await signup(name.trim(), email.trim(), password, assignedRole, inviteToken || undefined);
      redirect(data.role);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create account');
      setIsSubmitting(false);
    }
  };

  // Show invite validation state
  if (inviteToken && inviteValid === null) {
    return (
      <div className="flex min-h-screen bg-zinc-950 items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-zinc-400">
          <Loader2 className="w-8 h-8 animate-spin" />
          <p className="text-sm">Validating invite link…</p>
        </div>
      </div>
    );
  }

  if (inviteToken && inviteValid === false) {
    return (
      <div className="flex min-h-screen bg-zinc-950 items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <div className="w-14 h-14 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-7 h-7 text-red-400" />
          </div>
          <h2 className="text-lg font-bold text-zinc-100 mb-2">Invalid Invite Link</h2>
          <p className="text-sm text-zinc-400 mb-6">This invite link is invalid, expired, or has already been used.</p>
          <Link to="/login" className="text-sm text-blue-400 hover:text-blue-300 underline">Back to login</Link>
        </div>
      </div>
    );
  }

  const isInvite = inviteToken && inviteValid;

  return (
    <div className="flex min-h-screen bg-zinc-950 text-zinc-100">

      {/* Left hero */}
      <div className="hidden lg:flex lg:w-5/12 xl:w-1/2 flex-col justify-between p-10 bg-zinc-900 border-r border-zinc-800 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-72 h-72 bg-blue-600/8 rounded-full blur-3xl translate-x-1/3 -translate-y-1/3 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-red-600/8 rounded-full blur-3xl -translate-x-1/3 translate-y-1/3 pointer-events-none" />

        <div className="relative">
          <div className="flex items-center gap-3 mb-12">
            <div className="w-10 h-10 rounded-full bg-red-600 flex items-center justify-center text-base font-black shadow-lg shadow-red-600/30">R</div>
            <span className="text-xl font-bold tracking-tight">ResQAI</span>
          </div>

          <h2 className="text-4xl xl:text-5xl font-black leading-[1.1] text-zinc-100 mb-5">
            Join the<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400">Emergency</span><br />
            Network.
          </h2>
          <p className="text-zinc-400 text-base leading-relaxed max-w-sm">
            Whether you need help or want to provide it — ResQAI connects citizens and volunteers in real time.
          </p>
        </div>

        <div className="relative space-y-4">
          {[
            { icon: '👤', title: 'Citizens', desc: 'Report emergencies, find shelters, request resources' },
            { icon: '🦺', title: 'Volunteers', desc: 'Accept incident tasks, fulfill resource requests, coordinate on chat' },
            { icon: '🛡️', title: 'Admins', desc: 'Invited only — manage the full emergency operations center' },
          ].map(({ icon, title, desc }) => (
            <div key={title} className="flex items-start gap-3">
              <span className="text-xl shrink-0 mt-0.5">{icon}</span>
              <div>
                <p className="text-sm font-semibold text-zinc-200">{title}</p>
                <p className="text-xs text-zinc-500 mt-0.5">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Right form */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-md">

          <div className="flex items-center gap-2 mb-8 lg:hidden">
            <div className="w-8 h-8 rounded-full bg-red-600 flex items-center justify-center font-black text-sm">R</div>
            <span className="font-bold">ResQAI</span>
          </div>

          {isInvite ? (
            <div className="flex items-center gap-3 mb-6 p-3.5 bg-green-950/40 border border-green-800/50 rounded-xl">
              <ShieldCheck className="w-5 h-5 text-green-400 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-green-400">Admin Invite</p>
                <p className="text-xs text-green-300/70 mt-0.5">
                  You've been invited as <strong>{inviteData?.role?.replace('_', ' ')}</strong>. Complete your registration below.
                </p>
              </div>
            </div>
          ) : (
            <>
              <h1 className="text-2xl font-bold mb-1">Create your account</h1>
              <p className="text-sm text-zinc-500 mb-6">Join the ResQAI emergency response network.</p>

              {/* Role toggle */}
              <div className="mb-6 p-1 bg-zinc-900 border border-zinc-800 rounded-xl flex gap-1">
                {[
                  { value: 'citizen',   label: 'Citizen',   desc: 'I need help / want to report' },
                  { value: 'responder', label: 'Volunteer', desc: 'I want to help others' },
                ].map(({ value, label, desc }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setRole(value)}
                    className={`flex-1 flex flex-col items-center py-2.5 px-2 rounded-lg text-center transition-all ${
                      role === value
                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    <span className="text-sm font-semibold">{label}</span>
                    <span className={`text-[10px] mt-0.5 ${role === value ? 'text-blue-200' : 'text-zinc-600'}`}>{desc}</span>
                  </button>
                ))}
              </div>
            </>
          )}

          {error && (
            <div className="flex items-center gap-2.5 mb-5 p-3.5 bg-red-950/40 border border-red-900/50 rounded-xl text-sm text-red-400">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3.5" noValidate>
            <div className="relative">
              <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
              <input
                type="text" required value={name} onChange={e => setName(e.target.value)}
                placeholder="Full name"
                className="w-full pl-10 pr-4 py-3 bg-zinc-900 border border-zinc-700 rounded-xl text-sm placeholder-zinc-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-all"
              />
            </div>

            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
              <input
                type="email" required value={email} onChange={e => setEmail(e.target.value)}
                placeholder="Email address"
                disabled={!!(isInvite && inviteData?.email)}
                className="w-full pl-10 pr-4 py-3 bg-zinc-900 border border-zinc-700 rounded-xl text-sm placeholder-zinc-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-all disabled:opacity-60"
              />
              {isInvite && inviteData?.email && (
                <CheckCircle className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-green-400" />
              )}
            </div>

            <div className="relative">
              <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
              <input
                type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                placeholder="Phone number (optional)"
                className="w-full pl-10 pr-4 py-3 bg-zinc-900 border border-zinc-700 rounded-xl text-sm placeholder-zinc-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-all"
              />
            </div>

            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
              <input
                type={showPwd ? 'text' : 'password'} required value={password} onChange={e => setPassword(e.target.value)}
                autoComplete="new-password" placeholder="Password (min. 8 characters)"
                className="w-full pl-10 pr-10 py-3 bg-zinc-900 border border-zinc-700 rounded-xl text-sm placeholder-zinc-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-all"
              />
              <button type="button" onClick={() => setShowPwd(p => !p)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition">
                {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            <button
              type="submit" disabled={isSubmitting}
              className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2 mt-2"
            >
              {isSubmitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating account…</> : 'Create account'}
            </button>
          </form>

          {!isInvite && (
            <>
              <div className="relative my-5">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-zinc-800" />
                </div>
                <div className="relative flex justify-center">
                  <span className="px-3 bg-zinc-950 text-xs text-zinc-600">or continue with</span>
                </div>
              </div>

              <button
                onClick={() => signupWithGoogle()}
                disabled={isSubmitting}
                className="w-full flex items-center justify-center gap-3 py-3 bg-zinc-900 hover:bg-zinc-800 disabled:opacity-50 border border-zinc-700 rounded-xl text-sm font-semibold transition-all duration-200 hover:border-zinc-600"
              >
                <svg viewBox="0 0 24 24" style={{ width: 18, height: 18 }}>
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
                Sign up with Google
              </button>
            </>
          )}

          <p className="mt-5 text-center text-sm text-zinc-500">
            Already have an account?{' '}
            <Link to="/login" className="font-semibold text-blue-400 hover:text-blue-300 transition-colors">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Signup;
