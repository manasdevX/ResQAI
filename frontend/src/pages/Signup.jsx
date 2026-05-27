import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  Loader2, Mail, Lock, User, Phone, AlertTriangle, Eye, EyeOff,
  CheckCircle, ShieldCheck, ArrowLeft, RefreshCw, ShieldAlert,
} from 'lucide-react';
import { useGoogleLogin } from '@react-oauth/google';
import axios from 'axios';

const _rawApi = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const API = _rawApi.startsWith('http://') || _rawApi.startsWith('https://')
  ? _rawApi.trim()
  : `https://${_rawApi.trim()}`;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const getPasswordStrength = (pwd) => {
  if (!pwd) return { score: 0, checks: {} };
  const checks = {
    length:    pwd.length >= 8,
    uppercase: /[A-Z]/.test(pwd),
    lowercase: /[a-z]/.test(pwd),
    number:    /\d/.test(pwd),
    special:   /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?~`]/.test(pwd),
  };
  const score = Object.values(checks).filter(Boolean).length;
  return { score, checks };
};

const STRENGTH_CONFIG = [
  null, // score 0
  { label: 'Too weak',    bar: 'bg-red-500',    text: 'text-red-400'    },
  { label: 'Weak',        bar: 'bg-orange-500',  text: 'text-orange-400' },
  { label: 'Fair',        bar: 'bg-yellow-400',  text: 'text-yellow-400' },
  { label: 'Strong',      bar: 'bg-emerald-400', text: 'text-emerald-400'},
  { label: 'Very strong', bar: 'bg-emerald-500', text: 'text-emerald-400'},
];

const CHECK_LABELS = [
  { key: 'length',    label: '8+ characters'       },
  { key: 'uppercase', label: 'Uppercase letter'     },
  { key: 'lowercase', label: 'Lowercase letter'     },
  { key: 'number',    label: 'Number'               },
  { key: 'special',   label: 'Special character'    },
];

const OTP_LENGTH = 6;

// ─── Component ────────────────────────────────────────────────────────────────

const Signup = () => {
  // ── Form state ──────────────────────────────────────────────────────────────
  const [name,       setName]       = useState('');
  const [email,      setEmail]      = useState('');
  const [phone,      setPhone]      = useState('');
  const [password,   setPassword]   = useState('');
  const [showPwd,    setShowPwd]    = useState(false);
  const [role,       setRole]       = useState('citizen');
  const [error,      setError]      = useState('');
  const [submitting, setSubmitting] = useState(false);

  // ── Email validation state ───────────────────────────────────────────────────
  const [emailTouched, setEmailTouched] = useState(false);
  const emailValid = EMAIL_REGEX.test(email.trim());
  const showEmailError = emailTouched && email.trim() && !emailValid;

  // ── Password strength ────────────────────────────────────────────────────────
  const [pwdTouched, setPwdTouched] = useState(false);
  const { score: pwdScore, checks: pwdChecks } = getPasswordStrength(password);

  // ── OTP step state ───────────────────────────────────────────────────────────
  const [step,             setStep]             = useState('form'); // 'form' | 'otp'
  const [verifiedEmail,    setVerifiedEmail]    = useState('');
  const [otp,              setOtp]              = useState(Array(OTP_LENGTH).fill(''));
  const [otpError,         setOtpError]         = useState('');
  const [otpSubmitting,    setOtpSubmitting]    = useState(false);
  const [remainingAttempts, setRemainingAttempts] = useState(5);
  const [resendCooldown,   setResendCooldown]   = useState(0);
  const [countdown,        setCountdown]        = useState(600); // 10 min
  const otpRefs = useRef([]);

  // ── Invite validation ────────────────────────────────────────────────────────
  const [inviteData,  setInviteData]  = useState(null);
  const [inviteValid, setInviteValid] = useState(null);

  const { signup, verifyOTP, resendOTP, googleLogin, roleHome } = useAuth();
  const navigate    = useNavigate();
  const [params]    = useSearchParams();
  const inviteToken = params.get('invite');
  const unverifiedEmail = params.get('unverified'); // from Login redirect

  const redirect = (r) => navigate(roleHome(r), { replace: true });

  // If redirected from Login with an unverified email, jump straight to OTP step
  useEffect(() => {
    if (unverifiedEmail) {
      setVerifiedEmail(decodeURIComponent(unverifiedEmail));
      setEmail(decodeURIComponent(unverifiedEmail));
      setCountdown(600);
      setStep('otp');
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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

  // OTP countdown timer
  useEffect(() => {
    if (step !== 'otp') return;
    if (countdown <= 0) return;
    const id = setInterval(() => setCountdown((c) => c - 1), 1000);
    return () => clearInterval(id);
  }, [step, countdown]);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const id = setInterval(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearInterval(id);
  }, [resendCooldown]);

  // ── OTP input handlers ───────────────────────────────────────────────────────
  const handleOTPChange = useCallback((index, value) => {
    if (!/^\d*$/.test(value)) return;
    const next = [...otp];
    next[index] = value.slice(-1);
    setOtp(next);
    setOtpError('');
    if (value && index < OTP_LENGTH - 1) {
      otpRefs.current[index + 1]?.focus();
    }
  }, [otp]);

  const handleOTPKeyDown = useCallback((index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
    if (e.key === 'ArrowLeft'  && index > 0)              otpRefs.current[index - 1]?.focus();
    if (e.key === 'ArrowRight' && index < OTP_LENGTH - 1) otpRefs.current[index + 1]?.focus();
  }, [otp]);

  const handleOTPPaste = useCallback((e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LENGTH);
    const next = Array(OTP_LENGTH).fill('');
    pasted.split('').forEach((ch, i) => { next[i] = ch; });
    setOtp(next);
    setOtpError('');
    const focusIdx = Math.min(pasted.length, OTP_LENGTH - 1);
    setTimeout(() => otpRefs.current[focusIdx]?.focus(), 0);
  }, []);

  // ── Google ───────────────────────────────────────────────────────────────────
  const handleGoogleSuccess = async (tokenResponse) => {
    if (!tokenResponse?.access_token) {
      setError('Google Sign-Up was blocked. Try disabling any popup blockers and retry.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const data = await googleLogin(tokenResponse.access_token, inviteData?.role || role);
      redirect(data.role);
    } catch (err) {
      setError(err.response?.data?.message || 'Google Sign-Up failed. Please try again.');
      setSubmitting(false);
    }
  };

  const signupWithGoogle = useGoogleLogin({
    onSuccess: handleGoogleSuccess,
    onError:   () => setError('Google Sign-Up was unsuccessful. Try again.'),
  });

  // ── Form submit (step 1) ─────────────────────────────────────────────────────
  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!name.trim())           { setError('Full name is required'); return; }
    if (!email.trim())          { setError('Email address is required'); return; }
    if (!emailValid)            { setError('Please enter a valid email address'); setEmailTouched(true); return; }
    if (pwdScore < 5)           { setError('Please satisfy all password requirements'); setPwdTouched(true); return; }

    setSubmitting(true);
    try {
      const assignedRole = inviteData?.role || role;
      await signup(name.trim(), email.trim(), password, assignedRole, inviteToken || undefined);
      setVerifiedEmail(email.trim().toLowerCase());
      setCountdown(600);
      setStep('otp');
      setTimeout(() => otpRefs.current[0]?.focus(), 100);
    } catch (err) {
      const data = err.response?.data;
      if (data?.requiresVerification) {
        setVerifiedEmail(data.email || email.trim().toLowerCase());
        setCountdown(600);
        setStep('otp');
        setTimeout(() => otpRefs.current[0]?.focus(), 100);
      } else {
        setError(data?.message || 'Failed to create account. Try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  // ── OTP submit (step 2) ──────────────────────────────────────────────────────
  const handleOTPSubmit = async (e) => {
    e.preventDefault();
    const code = otp.join('');
    if (code.length < OTP_LENGTH) { setOtpError('Please enter the complete 6-digit code'); return; }

    setOtpSubmitting(true);
    setOtpError('');
    try {
      const data = await verifyOTP(verifiedEmail, code);
      redirect(data.role);
    } catch (err) {
      const res = err.response?.data;
      setOtpError(res?.message || 'Incorrect code. Please try again.');
      if (typeof res?.remainingAttempts === 'number') setRemainingAttempts(res.remainingAttempts);
      // Reset OTP inputs on wrong code
      setOtp(Array(OTP_LENGTH).fill(''));
      setTimeout(() => otpRefs.current[0]?.focus(), 50);
    } finally {
      setOtpSubmitting(false);
    }
  };

  // ── Resend OTP ───────────────────────────────────────────────────────────────
  const handleResend = async () => {
    if (resendCooldown > 0) return;
    setOtpError('');
    try {
      await resendOTP(verifiedEmail);
      setOtp(Array(OTP_LENGTH).fill(''));
      setRemainingAttempts(5);
      setCountdown(600);
      setResendCooldown(60);
      setTimeout(() => otpRefs.current[0]?.focus(), 50);
    } catch (err) {
      const res = err.response?.data;
      const wait = res?.waitSeconds;
      if (wait) setResendCooldown(wait);
      setOtpError(res?.message || 'Could not resend code. Please try again.');
    }
  };

  const fmtTime = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  // ── Invite loading state ─────────────────────────────────────────────────────
  if (inviteToken && inviteValid === null) {
    return (
      <div className="flex min-h-screen bg-zinc-950 items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-zinc-400">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
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
          <Link to="/login" className="text-sm text-blue-400 hover:text-blue-300 underline transition-colors">
            Back to login
          </Link>
        </div>
      </div>
    );
  }

  const isInvite = !!(inviteToken && inviteValid);

  // ── OTP Step ─────────────────────────────────────────────────────────────────
  if (step === 'otp') {
    return (
      <div className="flex min-h-screen bg-zinc-950 text-zinc-100">

        {/* Left panel */}
        <div className="hidden lg:flex lg:w-5/12 xl:w-1/2 flex-col justify-center items-center p-10 bg-zinc-900 border-r border-zinc-800 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-72 h-72 bg-blue-600/8 rounded-full blur-3xl translate-x-1/3 -translate-y-1/3 pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-red-600/8 rounded-full blur-3xl -translate-x-1/3 translate-y-1/3 pointer-events-none" />
          <div className="relative text-center max-w-xs">
            <div className="w-20 h-20 rounded-full bg-blue-600/10 border border-blue-500/20 flex items-center justify-center mx-auto mb-6">
              <ShieldAlert className="w-10 h-10 text-blue-400" />
            </div>
            <h2 className="text-3xl font-black text-zinc-100 mb-3">Check your inbox</h2>
            <p className="text-zinc-400 text-sm leading-relaxed">
              We sent a 6-digit verification code to<br />
              <strong className="text-zinc-200">{verifiedEmail}</strong>
            </p>
            <p className="mt-4 text-xs text-zinc-600">
              Can't find it? Check your spam folder.
            </p>
          </div>
        </div>

        {/* Right OTP form */}
        <div className="flex-1 flex flex-col items-center justify-center p-6 sm:p-10">
          <div className="w-full max-w-md">

            <div className="flex items-center gap-2 mb-8 lg:hidden">
              <div className="w-8 h-8 rounded-full bg-red-600 flex items-center justify-center font-black text-sm">R</div>
              <span className="font-bold">ResQAI</span>
            </div>

            <button
              onClick={() => { setStep('form'); setOtp(Array(OTP_LENGTH).fill('')); setOtpError(''); }}
              className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-300 mb-6 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" /> Back
            </button>

            <h1 className="text-2xl font-bold mb-1">Verify your email</h1>
            <p className="text-sm text-zinc-500 mb-7">
              Enter the 6-digit code sent to{' '}
              <span className="text-zinc-300 font-medium">{verifiedEmail}</span>
            </p>

            {otpError && (
              <div className="flex items-start gap-2.5 mb-5 p-3.5 bg-red-950/40 border border-red-900/50 rounded-xl text-sm text-red-400">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{otpError}</span>
              </div>
            )}

            <form onSubmit={handleOTPSubmit}>
              {/* OTP digit boxes */}
              <div className="flex gap-2.5 justify-center mb-6">
                {Array.from({ length: OTP_LENGTH }, (_, i) => (
                  <input
                    key={i}
                    ref={(el) => { otpRefs.current[i] = el; }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={otp[i]}
                    onChange={(e) => handleOTPChange(i, e.target.value)}
                    onKeyDown={(e) => handleOTPKeyDown(i, e)}
                    onPaste={i === 0 ? handleOTPPaste : undefined}
                    disabled={otpSubmitting}
                    className={`w-12 h-14 text-center text-xl font-bold bg-zinc-900 border rounded-xl outline-none transition-all
                      ${otpError
                        ? 'border-red-500/60 focus:border-red-500 focus:ring-1 focus:ring-red-500/30'
                        : 'border-zinc-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30'}
                      disabled:opacity-50 caret-transparent`}
                  />
                ))}
              </div>

              {/* Countdown */}
              <p className="text-center text-xs text-zinc-600 mb-5">
                {countdown > 0
                  ? <>Code expires in <span className="text-zinc-400 font-medium tabular-nums">{fmtTime(countdown)}</span></>
                  : <span className="text-red-400">Code expired — please request a new one</span>}
              </p>

              <button
                type="submit"
                disabled={otpSubmitting || otp.join('').length < OTP_LENGTH}
                className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2"
              >
                {otpSubmitting
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Verifying…</>
                  : 'Verify & Create Account'}
              </button>
            </form>

            {/* Resend */}
            <div className="mt-5 text-center">
              <span className="text-sm text-zinc-500">Didn't receive a code?{' '}</span>
              {resendCooldown > 0 ? (
                <span className="text-sm text-zinc-600">
                  Resend in <span className="tabular-nums font-medium text-zinc-400">{resendCooldown}s</span>
                </span>
              ) : (
                <button
                  onClick={handleResend}
                  className="text-sm font-semibold text-blue-400 hover:text-blue-300 transition-colors inline-flex items-center gap-1"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Resend code
                </button>
              )}
            </div>

            {remainingAttempts < 5 && remainingAttempts > 0 && (
              <p className="mt-3 text-center text-xs text-orange-400">
                {remainingAttempts} attempt{remainingAttempts !== 1 ? 's' : ''} remaining
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── Form Step ─────────────────────────────────────────────────────────────────
  const strengthCfg = pwdScore > 0 ? STRENGTH_CONFIG[pwdScore] : null;

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
            { icon: '👤', title: 'Citizens',   desc: 'Report emergencies, find shelters, request resources' },
            { icon: '🦺', title: 'Volunteers', desc: 'Accept incident tasks, fulfill resource requests, coordinate' },
            { icon: '🛡️', title: 'Admins',     desc: 'Invited only — manage the full emergency operations center' },
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
      <div className="flex-1 flex flex-col items-center justify-center p-6 sm:p-10 overflow-y-auto">
        <div className="w-full max-w-md py-6">

          <div className="flex items-center gap-2 mb-8 lg:hidden">
            <div className="w-8 h-8 rounded-full bg-red-600 flex items-center justify-center font-black text-sm">R</div>
            <span className="font-bold">ResQAI</span>
          </div>

          {/* Invite badge */}
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
                  { value: 'citizen',   label: 'Citizen',   desc: 'I need help / report emergencies' },
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
            <div className="flex items-start gap-2.5 mb-5 p-3.5 bg-red-950/40 border border-red-900/50 rounded-xl text-sm text-red-400">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleFormSubmit} className="space-y-3.5" noValidate>

            {/* Name */}
            <div className="relative">
              <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Full name"
                className="w-full pl-10 pr-4 py-3 bg-zinc-900 border border-zinc-700 rounded-xl text-sm placeholder-zinc-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-all"
              />
            </div>

            {/* Email */}
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => { setEmail(e.target.value); setEmailTouched(false); }}
                onBlur={() => setEmailTouched(true)}
                placeholder="Email address"
                disabled={!!(isInvite && inviteData?.email)}
                className={`w-full pl-10 pr-10 py-3 bg-zinc-900 border rounded-xl text-sm placeholder-zinc-500 focus:outline-none transition-all disabled:opacity-60
                  ${showEmailError
                    ? 'border-red-500/60 focus:border-red-500 focus:ring-1 focus:ring-red-500/30'
                    : emailTouched && emailValid
                      ? 'border-emerald-600/60 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30'
                      : 'border-zinc-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30'}`}
              />
              {/* Validation icon */}
              {email.trim() && emailTouched && (
                <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none">
                  {emailValid
                    ? <CheckCircle className="w-4 h-4 text-emerald-400" />
                    : <AlertTriangle className="w-4 h-4 text-red-400" />}
                </div>
              )}
              {isInvite && inviteData?.email && (
                <CheckCircle className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-400 pointer-events-none" />
              )}
            </div>
            {showEmailError && (
              <p className="text-xs text-red-400 -mt-2 ml-1">Please enter a valid email address</p>
            )}

            {/* Phone */}
            <div className="relative">
              <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Phone number (optional)"
                className="w-full pl-10 pr-4 py-3 bg-zinc-900 border border-zinc-700 rounded-xl text-sm placeholder-zinc-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-all"
              />
            </div>

            {/* Password */}
            <div>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
                <input
                  type={showPwd ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); if (!pwdTouched && e.target.value) setPwdTouched(true); }}
                  onBlur={() => { if (password) setPwdTouched(true); }}
                  autoComplete="new-password"
                  placeholder="Password"
                  className={`w-full pl-10 pr-10 py-3 bg-zinc-900 border rounded-xl text-sm placeholder-zinc-500 focus:outline-none transition-all
                    ${pwdTouched && pwdScore < 5
                      ? 'border-orange-500/50 focus:border-orange-500 focus:ring-1 focus:ring-orange-500/30'
                      : pwdTouched && pwdScore === 5
                        ? 'border-emerald-600/60 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30'
                        : 'border-zinc-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30'}`}
                />
                <button
                  type="button"
                  onClick={() => setShowPwd((p) => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
                  tabIndex={-1}
                  aria-label={showPwd ? 'Hide password' : 'Show password'}
                >
                  {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {/* Password strength meter */}
              {pwdTouched && password && (
                <div className="mt-2.5 space-y-2">
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <div
                        key={n}
                        className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                          n <= pwdScore && strengthCfg ? strengthCfg.bar : 'bg-zinc-800'
                        }`}
                      />
                    ))}
                  </div>
                  {strengthCfg && (
                    <p className={`text-xs font-medium ${strengthCfg.text}`}>{strengthCfg.label}</p>
                  )}
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-1">
                    {CHECK_LABELS.map(({ key, label }) => (
                      <div key={key} className="flex items-center gap-1.5">
                        <div className={`w-3.5 h-3.5 rounded-full flex items-center justify-center shrink-0 transition-colors
                          ${pwdChecks[key] ? 'bg-emerald-500/20 text-emerald-400' : 'bg-zinc-800 text-zinc-600'}`}>
                          {pwdChecks[key]
                            ? <CheckCircle className="w-2.5 h-2.5" />
                            : <div className="w-1 h-1 rounded-full bg-current" />}
                        </div>
                        <span className={`text-[11px] transition-colors ${pwdChecks[key] ? 'text-zinc-400' : 'text-zinc-600'}`}>
                          {label}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2 mt-2"
            >
              {submitting
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Sending verification code…</>
                : 'Continue'}
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
                disabled={submitting}
                className="w-full flex items-center justify-center gap-3 py-3 bg-zinc-900 hover:bg-zinc-800 disabled:opacity-50 border border-zinc-700 hover:border-zinc-600 rounded-xl text-sm font-semibold transition-all duration-200"
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
