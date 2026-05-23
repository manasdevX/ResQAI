import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Mail, Loader2, AlertTriangle, CheckCircle, ArrowLeft } from 'lucide-react';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const ForgotPassword = () => {
  const { forgotPassword } = useAuth();

  const [email,        setEmail]        = useState('');
  const [emailTouched, setEmailTouched] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sent,         setSent]         = useState(false);
  const [error,        setError]        = useState('');

  const emailValid     = EMAIL_REGEX.test(email.trim());
  const showEmailError = emailTouched && email.trim() && !emailValid;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setEmailTouched(true);

    if (!email.trim()) { setError('Email address is required'); return; }
    if (!emailValid)   { setError('Please enter a valid email address'); return; }

    setIsSubmitting(true);
    try {
      await forgotPassword(email.trim());
      setSent(true);
    } catch (err) {
      // Backend always returns 200 to prevent enumeration — only show network errors
      setError(err.response?.data?.message || 'Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-zinc-950 text-zinc-100 items-center justify-center p-6">
      <div className="w-full max-w-md">

        {/* Logo */}
        <div className="flex items-center gap-2 mb-8">
          <div className="w-8 h-8 rounded-full bg-red-600 flex items-center justify-center font-black text-sm shadow-lg shadow-red-600/30">R</div>
          <span className="font-bold">ResQAI</span>
        </div>

        {sent ? (
          /* ── Success state ──────────────────────────────────────────────── */
          <div className="text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-green-500/15 border border-green-500/30 flex items-center justify-center mx-auto">
              <CheckCircle className="w-8 h-8 text-green-400" />
            </div>
            <h1 className="text-2xl font-bold">Check your inbox</h1>
            <p className="text-sm text-zinc-400 leading-relaxed">
              If <span className="text-zinc-200 font-medium">{email.trim()}</span> is registered,
              we've sent a password reset link. It expires in <span className="text-yellow-400 font-medium">1 hour</span>.
            </p>
            <p className="text-xs text-zinc-600">
              Didn't get it? Check your spam folder or{' '}
              <button
                onClick={() => { setSent(false); setEmail(''); }}
                className="text-blue-400 hover:text-blue-300 underline transition-colors"
              >
                try another email
              </button>.
            </p>
            <Link
              to="/login"
              className="inline-flex items-center gap-2 mt-4 text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" /> Back to login
            </Link>
          </div>
        ) : (
          /* ── Form state ─────────────────────────────────────────────────── */
          <>
            <h1 className="text-2xl font-bold mb-1">Forgot your password?</h1>
            <p className="text-sm text-zinc-500 mb-8">
              Enter your account email and we'll send you a reset link.
            </p>

            {error && (
              <div className="flex items-start gap-2.5 mb-5 p-3.5 bg-red-950/40 border border-red-900/50 rounded-xl text-sm text-red-400">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              <div>
                <div className="relative">
                  <Mail className={`absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none transition-colors ${showEmailError ? 'text-red-400' : 'text-zinc-500'}`} />
                  <input
                    type="email"
                    autoComplete="email"
                    autoFocus
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setEmailTouched(false); setError(''); }}
                    onBlur={() => { if (email.trim()) setEmailTouched(true); }}
                    placeholder="Email address"
                    className={`w-full pl-10 pr-4 py-3 bg-zinc-900 border rounded-xl text-sm placeholder-zinc-500 focus:outline-none transition-all ${
                      showEmailError
                        ? 'border-red-500/60 focus:border-red-500 focus:ring-1 focus:ring-red-500/30'
                        : 'border-zinc-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30'
                    }`}
                  />
                </div>
                {showEmailError && (
                  <p className="text-xs text-red-400 mt-1.5 ml-1">Please enter a valid email address</p>
                )}
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2"
              >
                {isSubmitting
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Sending…</>
                  : 'Send reset link'}
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

export default ForgotPassword;
