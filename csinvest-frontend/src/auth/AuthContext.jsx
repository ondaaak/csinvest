import React, { createContext, useContext, useMemo, useState, useEffect } from 'react';

const API_BASE = '/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const init = async () => {
      const token = localStorage.getItem('csinvest:token');
      const rawUser = localStorage.getItem('csinvest:user');
      if (rawUser) {
        try {
          const parsed = JSON.parse(rawUser);
          if (parsed && parsed.user_id) setUser(parsed);
        } catch {}
      } else if (token) {
        try {
          const res = await fetch(`${API_BASE}/auth/me`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (res.ok) {
            const u = await res.json();
            setUser(u);
            localStorage.setItem('csinvest:user', JSON.stringify(u));
          } else {
            localStorage.removeItem('csinvest:token');
          }
        } catch {
          localStorage.removeItem('csinvest:token');
        }
      }
    };
    init();
  }, []);

  const login = async ({ username, password }) => {
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      if (!res.ok) return false;
      const data = await res.json();
      localStorage.setItem('csinvest:token', data.access_token);
      localStorage.setItem('csinvest:user', JSON.stringify(data.user));
      setUser(data.user);
      return true;
    } catch {
      return false;
    }
  };

  const register = async ({ username, email, password, inviteCode }) => {
    try {
      const res = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password, invite_code: inviteCode })
      });
      if (!res.ok) {
        const err = await res.json();
        let msg = 'Registrace selhala';
        if (err.detail) {
            if (typeof err.detail === 'string') msg = err.detail;
            else if (Array.isArray(err.detail)) msg = err.detail.map(e => e.msg).join(', ');
            else msg = JSON.stringify(err.detail);
        }
        throw new Error(msg);
      }
      const data = await res.json();
      localStorage.setItem('csinvest:token', data.access_token);
      localStorage.setItem('csinvest:user', JSON.stringify(data.user));
      setUser(data.user);
      return true;
    } catch (e) {
      console.error(e);
      throw e;
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('csinvest:user');
    localStorage.removeItem('csinvest:token');
  };

  const value = useMemo(() => ({ user, userId: user?.user_id ?? null, login, register, logout }), [user]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
