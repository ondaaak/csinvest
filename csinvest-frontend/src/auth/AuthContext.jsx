import React, { createContext, useContext, useMemo, useState, useEffect } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('csinvest:user');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.id) setUser(parsed);
      }
    } catch {}
  }, []);

  const login = async ({ username, password }) => {
    // TODO: call backend; for now, mock user id=1 if any credentials provided
    if (username && password) {
      const u = { id: 1, username };
      setUser(u);
      localStorage.setItem('csinvest:user', JSON.stringify(u));
      return true;
    }
    return false;
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('csinvest:user');
  };

  const value = useMemo(() => ({ user, userId: user?.id ?? null, login, logout }), [user]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
