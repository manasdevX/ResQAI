import { createContext, useContext, useState, useEffect, useMemo, useCallback, useRef } from 'react';
import axios from 'axios';

const AuthContext = createContext();

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext);

export const roleHome = (role) => {
  switch (role) {
    case 'admin':           return '/admin';
    case 'responder':       return '/volunteer';
    case 'shelter_manager': return '/volunteer';
    default:                return '/home';
  }
};

export const AuthProvider = ({ children }) => {
  const [user,    setUser]    = useState(null);
  const [token,   setToken]   = useState(() => localStorage.getItem('token') || null);
  const [loading, setLoading] = useState(true);
  const fetchedRef = useRef(false);

  // Stable refs so the interceptor can call state setters without
  // being recreated on every token change (avoids stale-closure issues)
  const setTokenRef   = useRef(setToken);
  const setUserRef    = useRef(setUser);
  const setLoadingRef = useRef(setLoading);

  const api = useMemo(() => {
    const instance = axios.create({
      baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });

    instance.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          localStorage.removeItem('token');
          // Use React state — NOT window.location.href — so we never race
          // the finally block and never leave loading=true forever.
          // ProtectedRoute will redirect to /login automatically.
          fetchedRef.current = false;
          setTokenRef.current(null);
          setUserRef.current(null);
          setLoadingRef.current(false);
        }
        return Promise.reject(error);
      }
    );

    return instance;
  }, [token]);

  // Restore session from stored token on mount
  useEffect(() => {
    let cancelled = false;

    const fetchUser = async () => {
      const storedToken = localStorage.getItem('token');
      if (!storedToken) {
        setLoading(false);
        return;
      }
      try {
        const { data } = await api.get('/auth/me');
        if (!cancelled) setUser(data);
      } catch {
        if (!cancelled) {
          localStorage.removeItem('token');
          setToken(null);
          setUser(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    if (user) { setLoading(false); return; }
    if (fetchedRef.current) return;
    fetchedRef.current = true;

    fetchUser();
    return () => { cancelled = true; };
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  const persistAuth = useCallback((data) => {
    const { token: newToken, ...userData } = data;
    localStorage.setItem('token', newToken);
    fetchedRef.current = true;
    setToken(newToken);
    setUser(userData);
  }, []);

  const updateUser = useCallback((patch) => {
    setUser((prev) => (prev ? { ...prev, ...patch } : prev));
  }, []);

  // ── Auth actions ────────────────────────────────────────────────────────────

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
    persistAuth(data);
    return data;
  };

  const forgotPassword = async (email) => {
    const { data } = await api.post('/auth/forgot-password', { email });
    return data;
  };

  const resetPassword = async (token, password) => {
    const { data } = await api.post('/auth/reset-password', { token, password });
    return data;
  };

  const logout = () => {
    localStorage.removeItem('token');
    fetchedRef.current = false;
    setToken(null);
    setUser(null);
    setLoading(false);
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
