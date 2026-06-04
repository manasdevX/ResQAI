import { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import axios from 'axios';

const AuthContext = createContext();

// Sanitize the API URL from env — ensures it always starts with http(s)://
// Guards against Vercel/Render misconfiguration where the protocol is omitted or has extra whitespace.
const getApiUrl = () => {
  const raw = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').trim();
  const lower = raw.toLowerCase();
  if (lower.startsWith('http://') || lower.startsWith('https://')) return raw;
  // Missing protocol — assume https for production
  return `https://${raw}`;
};

const API_URL = getApiUrl();

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext);

export const roleHome = (role) => {
  switch (role) {
    case 'admin':           return '/admin';
    case 'responder': return '/volunteer';
    default:                return '/home';
  }
};

export const AuthProvider = ({ children }) => {
  const [user,    setUser]    = useState(null);
  const [token,   setToken]   = useState(() => localStorage.getItem('token') || null);
  const [loading, setLoading] = useState(true);

  // Build an axios instance that always sends the current token.
  // Recreated only when token changes (so headers stay fresh after login).
  const api = useMemo(() => {
    const instance = axios.create({
      baseURL: API_URL,
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });

    // On 401: clear storage only. React state + routing handled by callers / ProtectedRoute.
    // Do NOT touch React state here — doing so inside useMemo triggers cascading re-renders
    // that race with ongoing async operations and leave loading stuck at true.
    instance.interceptors.response.use(
      (res) => res,
      (err) => {
        if (err.response?.status === 401) {
          localStorage.removeItem('token');
        }
        return Promise.reject(err);
      }
    );

    return instance;
  }, [token]);

  // ── Session restoration ────────────────────────────────────────────────────
  // Runs ONCE on mount. Empty deps array is intentional — we only need to
  // restore a persisted session at startup. After that every auth action
  // (login / logout / persistAuth) manages state explicitly, so there is
  // nothing to "watch" on token changes here.
  useEffect(() => {
    const storedToken = localStorage.getItem('token');

    // No stored session → nothing to restore, show the app immediately.
    if (!storedToken) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    // Use a one-off axios instance with the stored token so we don't depend
    // on the `api` memo (which might not have the right header yet on first render).
    const authApi = axios.create({
      baseURL: API_URL,
      headers: { Authorization: `Bearer ${storedToken}` },
    });

    authApi.get('/auth/me')
      .then(({ data }) => {
        if (cancelled) return;
        setUser(data);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        // Token is invalid / expired — clear everything and show app (login page).
        localStorage.removeItem('token');
        setToken(null);
        setUser(null);
        setLoading(false);
      });

    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Helpers ────────────────────────────────────────────────────────────────

  const persistAuth = useCallback((data) => {
    const { token: newToken, ...userData } = data;
    localStorage.setItem('token', newToken);
    setToken(newToken);
    setUser(userData);
  }, []);

  const updateUser = useCallback((patch) => {
    setUser((prev) => (prev ? { ...prev, ...patch } : prev));
  }, []);

  // ── Auth actions ───────────────────────────────────────────────────────────

  const login = async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    persistAuth(data);
    return data;
  };

  // Step 1: creates account + sends OTP — does NOT return an auth token
  const signup = async (name, email, password, role, inviteToken) => {
    const { data } = await api.post('/auth/signup', { name, email, password, role, inviteToken });
    return data; // { requiresVerification: true, email, message }
  };

  // Step 2: verifies OTP — returns auth token on success
  const verifyOTP = async (email, otp) => {
    const { data } = await api.post('/auth/verify-otp', { email, otp });
    if (data.token) persistAuth(data);
    return data;
  };

  // Resend OTP for an unverified account
  const resendOTP = async (email) => {
    const { data } = await api.post('/auth/resend-otp', { email });
    return data;
  };

  const googleLogin = async (googleToken, role) => {
    const { data } = await api.post('/auth/google', { token: googleToken, role });
    if (!data.requiresRole) {
      persistAuth(data);
    }
    return data;
  };

  const forgotPassword = async (email) => {
    const { data } = await api.post('/auth/forgot-password', { email });
    return data;
  };

  const resetPassword = async (tkn, password) => {
    const { data } = await api.post('/auth/reset-password', { token: tkn, password });
    return data;
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
  };

  const value = {
    user,
    token,
    loading,
    api,
    login,
    signup,
    verifyOTP,
    resendOTP,
    googleLogin,
    forgotPassword,
    resetPassword,
    logout,
    updateUser,
    roleHome,
  };

  return (
    <AuthContext.Provider value={value}>
      {loading ? (
        <div className="flex h-screen w-full items-center justify-center bg-zinc-950">
          <div className="w-8 h-8 border-4 border-red-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : children}
    </AuthContext.Provider>
  );
};
