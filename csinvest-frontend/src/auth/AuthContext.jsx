import React, { createContext, useContext, useMemo, useState, useEffect, useCallback } from 'react';

const API_BASE = '/api';

const AuthContext = createContext(null);

function readStoredUser() {
  const rawUser = localStorage.getItem('csinvest:user');
  if (!rawUser) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawUser);
    return parsed && parsed.user_id ? parsed : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [user, setUserState] = useState(null);

  const clearStoredAuth = useCallback(() => {
    setUserState(null);
    // Keep clearing legacy token while migrating to cookie-based auth.
    localStorage.removeItem('csinvest:token');
    localStorage.removeItem('csinvest:user');
  }, []);

  const setUser = useCallback((nextUser) => {
    setUserState(nextUser);
    if (nextUser) {
      localStorage.setItem('csinvest:user', JSON.stringify(nextUser));
    } else {
      localStorage.removeItem('csinvest:user');
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      const token = localStorage.getItem('csinvest:token');
      if (!token) {
        const cachedUser = readStoredUser();
        if (cachedUser) {
          setUser(cachedUser);
        }
      }

      try {
        const res = await fetch(`${API_BASE}/auth/me`, {
          credentials: 'include',
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });
        if (res.ok) {
          const u = await res.json();
          setUser(u);
          // Drop legacy token once cookie auth has succeeded.
          localStorage.removeItem('csinvest:token');
          return;
        }

        if (res.status === 401 || res.status === 404) {
          clearStoredAuth();
        }
      } catch {
        // Ignore transient auth bootstrap failures and keep cached user if available.
      }
    };
    init();
  }, [clearStoredAuth, setUser]);

  const login = useCallback(async ({ username, password }) => {
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      if (!res.ok) return false;
      const data = await res.json();
      localStorage.removeItem('csinvest:token');
      setUser(data.user);
      return true;
    } catch {
      return false;
    }
  }, [setUser]);

  const register = useCallback(async ({ username, email, password }) => {
    try {
      const res = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password })
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
      localStorage.removeItem('csinvest:token');
      setUser(data.user);
      return true;
    } catch (e) {
      console.error(e);
      throw e;
    }
  }, [setUser]);

  const logout = useCallback(() => {
    fetch(`${API_BASE}/auth/logout`, {
      method: 'POST',
      credentials: 'include',
    }).catch(() => {});
    clearStoredAuth();
  }, [clearStoredAuth]);

  const value = useMemo(() => ({ user, userId: user?.user_id ?? null, login, register, logout, setUser }), [user, login, logout, register, setUser]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
