import { createContext, useContext, useState, useEffect, useMemo } from 'react';
import axios from 'axios';

const AuthContext = createContext();

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser]     = useState(null);
  const [token, setToken]   = useState(() => localStorage.getItem('token') || null);
  const [loading, setLoading] = useState(true);

  // Stable axios instance — recreated only when token changes
  const api = useMemo(() => {
    const instance = axios.create({ 
      baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api' 
    });

    if (token) {
      instance.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    }

    return instance;
  }, [token]);

  // On mount: if a token exists in storage, validate it and hydrate user state
  useEffect(() => {
    const fetchUser = async () => {
      // If we already have a user in state (e.g. from login), don't re-validate
      if (user) {
        setLoading(false);
        return;
      }

      const storedToken = localStorage.getItem('token');
      if (storedToken) {
        try {
          const { data } = await api.get('/auth/me');
          setUser(data);
        } catch (error) {
          console.error('Session validation failed:', error);
          localStorage.removeItem('token');
          setToken(null);
          setUser(null);
        }
      }
      setLoading(false);
    };

    fetchUser();
  }, [api, user]); // validate session when api instance is ready or user state is empty

  // ── Helpers ──────────────────────────────────────────────────────────────────

  /** Save token + user after a successful auth API response */
  const persistAuth = (data) => {
    const { token: newToken, ...userData } = data;
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
