import { useState, useMemo } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Lock, Eye, EyeOff, Loader2, AlertTriangle, CheckCircle, ArrowLeft } from 'lucide-react';

// Password strength criteria — must all pass before submit is allowed
const CRITERIA = [
  { id: 'length',    label: 'At least 8 characters',          test: (p) => p.length >= 8 },
  { id: 'upper',     label: 'One uppercase letter',            test: (p) => /[A-Z]/.test(p) },
  { id: 'lower',     label: 'One lowercase letter',            test: (p) => /[a-z]/.test(p) },
  { id: 'number',    label: 'One number',                      test: (p) => /\d/.test(p) },
  { id: 'special',   label: 'One special character',           test: (p) => /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?~`]/.test(p) },
];

const ResetPassword = () => {
  const { resetPassword } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const token = searchParams.get('token') || '';

  const [password,    setPassword]    = useState('');
  const [confirm,     setConfirm]     = useState('');
  const [showPwd,     setShowPwd]     = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [done,        setDone]        = useState(false);
  const [error,       setError]       = useState('');

  const criteria = useMemo(() => CRITERIA.map(c => ({ ...c, passed: c.test(password) })), [password]);
  const allPassed = criteria.every(c => c.passed);
  const passedCount = criteria.filter(c => c.passed).length;

  const strengthColor = passedCount <= 1 ? 'bg-red-500' : passedCount <= 3 ? 'bg-yellow-500' : passedCount === 4 ? 'bg-blue-500' : 'bg-green-500';
  const strengthLabel = passedCount <= 1 ? 'Very weak' : passedCount <= 3 ? 'Fair' : passedCount === 4 ? 'Good' : 'Strong';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!password)   { setError('New password is required'); return; }
    if (!allPassed)  { setError('Password does not meet all requirements'); return; }
    if (password !== confirm) { setError('Passwords do not match'); return; }

    setIsSubmitting(true);
    try {
      await resetPassword(token, password);
      setDone(true);
      setTimeout(() => navigate('/login', { replace: true, state: { passwordReset: true } }), 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Reset failed. The link may have expired.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // No token in URL — show helpful error
  if (!token) {
    return (
      <div className="flex min-h-screen bg-zinc-950 text-zinc-100 items-center justify-center p-6">
        <div className="w-full max-w-md text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-red-500/15 border border-red-500/30 flex items-center justify-center mx-auto">
            <AlertTriangle className="w-8 h-8 text-red-400" />
          </div>
          <h1 className="text-2xl font-bold">Invalid reset link</h1>
          <p className="text-sm text-zinc-400">This link is missing or malformed. Please request a new one.</p>
          <Link
            to="/forgot-password"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-xl transition-all"
          >
            Request a new link
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-zinc-950 text-zinc-100 items-center justify-center p-6">
      <div className="w-full max-w-md">

        {/* Logo */}
        <div className="flex items-center gap-2.5 mb-8">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center font-black text-sm shadow-lg shadow-red-600/30">R</div>
          <span className="font-black tracking-tight">ResQ<span className="text-red-400">AI</span></span>
        </div>

        {done ? (
          /* ── Success ─────────────────────────────────────────────────────── */
          <div className="text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-green-500/15 border border-green-500/30 flex items-center justify-center mx-auto">
              <CheckCircle className="w-8 h-8 text-green-400" />
            </div>
            <h1 className="text-2xl font-bold">Password updated!</h1>
            <p className="text-sm text-zinc-400">Your password has been reset successfully. Redirecting to login…</p>
            <Link to="/login" className="inline-flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 transition-colors">
              <ArrowLeft className="w-4 h-4" /> Go to login now
            </Link>
          </div>
        ) : (
          /* ── Form ────────────────────────────────────────────────────────── */
          <>
            <h1 className="text-2xl font-black tracking-tight mb-1">Set a new password</h1>
            <p className="text-sm text-zinc-500 mb-8">Choose a strong password you haven't used before.</p>

            {error && (
              <div className="flex items-start gap-2.5 mb-5 p-3.5 bg-red-950/40 border border-red-900/50 rounded-xl text-sm text-red-400">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4" noValidate>

              {/* New password */}
              <div>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
                  <input
                    type={showPwd ? 'text' : 'password'}
                    autoComplete="new-password"
                    autoFocus
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setError(''); }}
                    placeholder="New password"
                    className="w-full pl-10 pr-10 py-3 bg-zinc-900 border border-zinc-700 rounded-xl text-sm placeholder-zinc-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd(p => !p)}
                    tabIndex={-1}
                    aria-label={showPwd ? 'Hide password' : 'Show password'}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors p-1"
                  >
                    {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                {/* Strength bar */}
                {password.length > 0 && (
                  <div className="mt-2.5 space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${strengthColor}`}
                          style={{ width: `${(passedCount / CRITERIA.length) * 100}%` }}
                        />
                      </div>
                      <span className={`text-[10px] font-semibold shrink-0 ${strengthColor.replace('bg-', 'text-')}`}>
                        {strengthLabel}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 gap-1">
                      {criteria.map(c => (
                        <div key={c.id} className="flex items-center gap-2">
                          <div className={`w-3.5 h-3.5 rounded-full flex items-center justify-center shrink-0 transition-colors ${c.passed ? 'bg-green-500/20 border border-green-500/40' : 'bg-zinc-800 border border-zinc-700'}`}>
                            {c.passed && <div className="w-1.5 h-1.5 rounded-full bg-green-400" />}
                          </div>
                          <span className={`text-[11px] transition-colors ${c.passed ? 'text-green-400' : 'text-zinc-500'}`}>
                            {c.label}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Confirm password */}
              <div>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
                  <input
                    type={showConfirm ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={confirm}
                    onChange={(e) => { setConfirm(e.target.value); setError(''); }}
                    placeholder="Confirm new password"
                    className={`w-full pl-10 pr-10 py-3 bg-zinc-900 border rounded-xl text-sm placeholder-zinc-500 focus:outline-none transition-all ${
                      confirm.length > 0 && password !== confirm
                        ? 'border-red-500/60 focus:border-red-500 focus:ring-1 focus:ring-red-500/30'
                        : confirm.length > 0 && password === confirm
                          ? 'border-green-600/60 focus:border-green-500 focus:ring-1 focus:ring-green-500/30'
                          : 'border-zinc-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(p => !p)}
                    tabIndex={-1}
                    aria-label={showConfirm ? 'Hide password' : 'Show password'}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors p-1"
                  >
                    {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {confirm.length > 0 && password !== confirm && (
                  <p className="text-xs text-red-400 mt-1.5 ml-1">Passwords do not match</p>
                )}
              </div>

              <button
                type="submit"
                disabled={isSubmitting || !allPassed || password !== confirm}
                className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2"
              >
                {isSubmitting
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Updating…</>
                  : 'Update password'}
              </button>
            </form>

            <Link
              to="/login"
              className="mt-6 flex items-center justify-center gap-2 text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" /> Back to login
            </Link>
          </>
        )}
      </div>
    </div>
  );
};

export default ResetPassword;
