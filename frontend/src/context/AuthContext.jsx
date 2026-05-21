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
          if (
            !window.location.pathname.startsWith('/login') &&
            !window.location.pathname.startsWith('/signup')
          ) {
            window.location.href = '/login';
          }
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
    logout,
    updateUser,
    roleHome,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
