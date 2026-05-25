import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Loader2, Mail, Lock, AlertTriangle, Eye, EyeOff, CheckCircle } from 'lucide-react';
import { useGoogleLogin } from '@react-oauth/google';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const Login = () => {
  const [email,        setEmail]        = useState('');
  const [password,     setPassword]     = useState('');
  const [showPwd,      setShowPwd]      = useState(false);
  const [error,        setError]        = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Real-time email validation state
  const [emailTouched, setEmailTouched] = useState(false);
  const emailValid      = EMAIL_REGEX.test(email.trim());
  const showEmailError  = emailTouched && email.trim() && !emailValid;
  const showEmailValid  = emailTouched && emailValid;

  const { login, googleLogin, roleHome } = useAuth();
  const navigate = useNavigate();

  const redirect = (role) => navigate(roleHome(role), { replace: true });

  const handleGoogleSuccess = async (tokenResponse) => {
    setIsSubmitting(true);
    setError('');
    try {
      const data = await googleLogin(tokenResponse.access_token);
      redirect(data.role);
    } catch (err) {
      setError(err.response?.data?.message || 'Google Sign-In failed');
      setIsSubmitting(false);
    }
  };

  const loginWithGoogle = useGoogleLogin({
    onSuccess: handleGoogleSuccess,
    onError:   () => setError('Google Sign-In was unsuccessful. Try again.'),
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!email.trim())  { setError('Email address is required'); setEmailTouched(true); return; }
    if (!emailValid)    { setError('Please enter a valid email address'); setEmailTouched(true); return; }
    if (!password)      { setError('Password is required'); return; }

    setIsSubmitting(true);
    try {
      const data = await login(email.trim(), password);
      redirect(data.role);
    } catch (err) {
      const res = err.response?.data;

      // Account exists but email not yet verified — redirect to signup OTP step
      if (res?.requiresVerification) {
        navigate(`/signup?unverified=${encodeURIComponent(res.email || email.trim())}`);
        return;
      }

      setError(res?.message || 'Invalid email or password');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-zinc-950 text-zinc-100">

      {/* Left hero */}
      <div className="hidden lg:flex lg:w-5/12 xl:w-1/2 flex-col justify-between p-10 bg-zinc-900 border-r border-zinc-800 relative overflow-hidden">
        {/* Ambient glows */}
        <div className="absolute top-0 left-0 w-96 h-96 bg-red-600/12 rounded-full blur-3xl -translate-x-1/3 -translate-y-1/3 pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-blue-600/8 rounded-full blur-3xl translate-x-1/3 translate-y-1/3 pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-orange-600/3 rounded-full blur-3xl pointer-events-none" />

        <div className="relative">
          {/* Logo */}
          <div className="flex items-center gap-3 mb-12">
            <div className="w-11 h-11 rounded-2xl bg-red-600 flex items-center justify-center font-black text-lg shadow-xl shadow-red-600/40">
              <span className="text-white">R</span>
            </div>
            <div>
              <span className="text-xl font-black tracking-tight">ResQ<span className="text-red-400">AI</span></span>
              <p className="text-[10px] text-zinc-500 font-medium -mt-0.5">Emergency Response Platform</p>
            </div>
          </div>

          <h2 className="text-4xl xl:text-5xl font-black leading-[1.1] text-zinc-100 mb-5">
            Emergency<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-400 via-orange-400 to-yellow-400">
              Coordination
            </span><br />
            Made Smart.
          </h2>
          <p className="text-zinc-400 text-base leading-relaxed max-w-sm">
            AI-powered real-time incident response for civilians,
            volunteers, and emergency administrators.
          </p>
        </div>

        <div className="relative space-y-3.5">
          {[
            { icon: '🗺️', label: 'Live incident map with geospatial search', color: 'text-blue-400' },
            { icon: '🤖', label: 'AI triage and risk scoring via Gemini',     color: 'text-purple-400' },
            { icon: '🏥', label: 'Real-time shelter & hospital finder',        color: 'text-teal-400'  },
            { icon: '🚨', label: 'One-tap SOS with GPS location broadcast',   color: 'text-red-400'   },
          ].map(({ icon, label, color }) => (
            <div key={label} className="flex items-center gap-3 text-sm">
              <span className={`w-8 h-8 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center text-base shrink-0`}>{icon}</span>
              <span className="text-zinc-300">{label}</span>
            </div>
          ))}

          {/* Live system status */}
          <div className="mt-6 flex items-center gap-2 px-3 py-2 bg-green-950/30 border border-green-800/30 rounded-xl w-fit">
            <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            <span className="text-xs text-green-400 font-semibold">All systems operational</span>
          </div>
        </div>
      </div>

      {/* Right form */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-md">

          <div className="flex items-center gap-2 mb-8 lg:hidden">
            <div className="w-8 h-8 rounded-full bg-red-600 flex items-center justify-center font-black text-sm">R</div>
            <span className="font-bold">ResQAI</span>
          </div>

          <h1 className="text-2xl font-bold mb-1">Welcome back</h1>
          <p className="text-sm text-zinc-500 mb-8">Sign in to access your dashboard.</p>

          {error && (
            <div className="flex items-start gap-2.5 mb-5 p-3.5 bg-red-950/40 border border-red-900/50 rounded-xl text-sm text-red-400">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>

            {/* Email */}
            <div>
              <div className="relative">
                <Mail className={`absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none transition-colors
                  ${showEmailError ? 'text-red-400' : showEmailValid ? 'text-emerald-400' : 'text-zinc-500'}`} />
                <input
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setEmailTouched(false); }}
                  onBlur={() => { if (email.trim()) setEmailTouched(true); }}
                  placeholder="Email address"
                  className={`w-full pl-10 pr-10 py-3 bg-zinc-900 border rounded-xl text-sm placeholder-zinc-500 focus:outline-none transition-all
                    ${showEmailError
                      ? 'border-red-500/60 focus:border-red-500 focus:ring-1 focus:ring-red-500/30'
                      : showEmailValid
                        ? 'border-emerald-600/60 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30'
                        : 'border-zinc-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30'}`}
                />
                {email.trim() && emailTouched && (
                  <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none">
                    {emailValid
                      ? <CheckCircle className="w-4 h-4 text-emerald-400" />
                      : <AlertTriangle className="w-4 h-4 text-red-400" />}
                  </div>
                )}
              </div>
              {showEmailError && (
                <p className="text-xs text-red-400 mt-1.5 ml-1">Please enter a valid email address</p>
              )}
            </div>

            {/* Password */}
            <div>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
                <input
                  type={showPwd ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  className="w-full pl-10 pr-10 py-3 bg-zinc-900 border border-zinc-700 rounded-xl text-sm placeholder-zinc-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd((p) => !p)}
                  tabIndex={-1}
                  aria-label={showPwd ? 'Hide password' : 'Show password'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors p-1"
                >
                  {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <div className="flex justify-end mt-1.5">
                <Link
                  to="/forgot-password"
                  className="text-xs text-zinc-500 hover:text-blue-400 transition-colors"
                >
                  Forgot password?
                </Link>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2"
            >
              {isSubmitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Signing in…</> : 'Sign in'}
            </button>
          </form>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-zinc-800" />
            </div>
            <div className="relative flex justify-center">
              <span className="px-3 bg-zinc-950 text-xs text-zinc-600">or continue with</span>
            </div>
          </div>

          <button
            onClick={() => loginWithGoogle()}
            disabled={isSubmitting}
            className="w-full flex items-center justify-center gap-3 py-3 bg-zinc-900 hover:bg-zinc-800 disabled:opacity-50 border border-zinc-700 hover:border-zinc-600 rounded-xl text-sm font-semibold transition-all duration-200"
          >
            <svg viewBox="0 0 24 24" style={{ width: 18, height: 18 }}>
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            Sign in with Google
          </button>

          <p className="mt-6 text-center text-sm text-zinc-500">
            Don't have an account?{' '}
            <Link to="/signup" className="font-semibold text-blue-400 hover:text-blue-300 transition-colors">
              Sign up free
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
