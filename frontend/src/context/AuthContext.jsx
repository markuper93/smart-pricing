import { createContext, useContext, useState, useEffect } from 'react';
import api from '../api/client';
import { trackLogout } from '../api/tracker';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      api.get('/auth/me').then(res => { setUser(res.data); setLoading(false); }).catch(() => { localStorage.removeItem('token'); setLoading(false); });
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (username, password) => {
    const res = await api.post('/auth/login', { username, password });
    // Always store token if present
    if (res.data.access_token) {
      localStorage.setItem('token', res.data.access_token);
    }
    if (res.data.requires_password_change) {
      setUser({ id: res.data.user_id, username: res.data.username, is_admin: res.data.is_admin, needsPasswordChange: true });
      return { requiresPasswordChange: true, userId: res.data.user_id };
    }
    setUser({ id: res.data.user_id, username: res.data.username, is_admin: res.data.is_admin });
    return { success: true };
  };

  const logout = () => {
    trackLogout();
    localStorage.removeItem('token');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, isAdmin: user?.is_admin }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
