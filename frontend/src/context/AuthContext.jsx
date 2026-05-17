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
  const fetchedRef = useRef(false); // prevent duplicate fetches

  const api = useMemo(() => {
    const instance = axios.create({
      baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });

    // Globally handle 401 — expired / invalid token → force re-login
    instance.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          localStorage.removeItem('token');
          // Only redirect if not already on login/signup page
          if (!window.location.pathname.startsWith('/login') &&
              !window.location.pathname.startsWith('/signup')) {
            window.location.href = '/login';
          }
        }
        return Promise.reject(error);
      }
    );

    return instance;
  }, [token]);

  // Fetch user from token on mount / token change — only when no user in memory
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

    // Skip if we've already got a user in state (e.g. after login)
    if (user) {
      setLoading(false);
      return;
    }

    // Only run once per token value (guard against React StrictMode double-invoke)
    if (fetchedRef.current) return;
    fetchedRef.current = true;

    fetchUser();
    return () => { cancelled = true; };
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  const persistAuth = (data) => {
    const { token: newToken, ...userData } = data;
    localStorage.setItem('token', newToken);
    fetchedRef.current = true; // mark fetched so useEffect doesn't re-run /auth/me
    setToken(newToken);
    setUser(userData);
  };

  const updateUser = useCallback((patch) => {
    setUser(prev => prev ? { ...prev, ...patch } : prev);
  }, []);

  const login = async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    persistAuth(data);
    return data;
  };

  const signup = async (name, email, password, role, inviteToken) => {
    const { data } = await api.post('/auth/signup', { name, email, password, role, inviteToken });
    persistAuth(data);
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
