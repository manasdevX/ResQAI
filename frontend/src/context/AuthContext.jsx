import { createContext, useContext, useState, useEffect, useRef, useMemo } from 'react';
import axios from 'axios';

const AuthContext = createContext();

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser]     = useState(null);
  const [token, setToken]   = useState(() => localStorage.getItem('token') || null);
  const [loading, setLoading] = useState(true);

  // Keep a mutable ref so interceptors always read the freshest token
  // without needing to be recreated on every token change.
  const tokenRef = useRef(token);

  // Sync ref whenever token state changes
  useEffect(() => {
    tokenRef.current = token;
  }, [token]);

  // Stable axios instance — created once for the lifetime of the provider
  const api = useMemo(() => {
    const instance = axios.create({ baseURL: 'http://localhost:5000/api' });

    instance.interceptors.request.use((config) => {
      const t = tokenRef.current;
      if (t) {
        config.headers.Authorization = `Bearer ${t}`;
      }
      return config;
    });

    return instance;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally empty — instance must not be recreated

  // On mount: if a token exists in storage, validate it and hydrate user state
  useEffect(() => {
    const fetchUser = async () => {
      const storedToken = tokenRef.current;
      if (storedToken) {
        try {
          const { data } = await api.get('/auth/me');
          setUser(data);
        } catch (error) {
          // Token is invalid or expired — clear everything
          console.error('Session validation failed:', error);
          tokenRef.current = null;
          localStorage.removeItem('token');
          setToken(null);
          setUser(null);
        }
      }
      setLoading(false);
    };

    fetchUser();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // run once on mount only

  // ── Helpers ──────────────────────────────────────────────────────────────────

  /** Save token + user after a successful auth API response */
  const persistAuth = (data) => {
    const { token: newToken, ...userData } = data;
    tokenRef.current = newToken;           // update ref immediately (before state flush)
    localStorage.setItem('token', newToken);
    setToken(newToken);
    setUser(userData);
  };

  // ── Auth actions ──────────────────────────────────────────────────────────────

  const login = async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    persistAuth(data);
  };

  const signup = async (name, email, password, role) => {
    const { data } = await api.post('/auth/signup', { name, email, password, role });
    persistAuth(data);
  };

  const googleLogin = async (googleToken) => {
    const { data } = await api.post('/auth/google', { token: googleToken });
    persistAuth(data);
  };

  const logout = () => {
    tokenRef.current = null; // clear immediately so in-flight requests drop the header
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
  };

  // ── Context value ─────────────────────────────────────────────────────────────

  const value = {
    user,
    token,
    loading,
    api,           // expose stable api instance for use in other hooks/components
    login,
    signup,
    googleLogin,
    logout,
  };

  // Render children only after the initial session check completes
  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
