import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useAuth } from '../auth/AuthContext.jsx';

const API_BASE = '/api';

const FALLBACK_RATES = {
  USD: 1,
  EUR: 0.86,   
  GBP: 0.75,  
  CZK: 20.77,  
  RUB: 77.73,  
};

const SYMBOLS = {
  USD: '$',
  EUR: '€',
  GBP: '£',
  CZK: 'Kč',
  RUB: '₽',
};

const ORDER = ['USD','EUR','GBP','CZK','RUB'];

const normalizeCurrency = (value) => {
  const next = String(value || '').toUpperCase();
  return ORDER.includes(next) ? next : 'USD';
};

const CurrencyContext = createContext({
  currency: 'USD',
  setCurrency: () => {},
  formatPrice: (value) => value,
  cycleCurrency: () => {},
  refreshRates: () => {},
  rates: FALLBACK_RATES,
  lastUpdated: null,
  loadingRates: false,
});

export const CurrencyProvider = ({ children }) => {
  const { user, setUser } = useAuth();
  const [currency, setCurrency] = useState('USD');
  const [rates, setRates] = useState(FALLBACK_RATES);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [loadingRates, setLoadingRates] = useState(false);


  useEffect(() => {
    try {
      const cachedCurrency = localStorage.getItem('csinvest:currency');
      if (cachedCurrency) {
        setCurrency(normalizeCurrency(cachedCurrency));
      }
    } catch (e) {
      // Ignore localStorage access errors.
    }

    try {
      const cached = localStorage.getItem('csinvest:fx');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed.timestamp && Date.now() - parsed.timestamp < 12 * 60 * 60 * 1000 && parsed.rates) {
          setRates({ ...FALLBACK_RATES, ...parsed.rates });
          setLastUpdated(parsed.timestamp);
          return;
        }
      }
    } catch (e) {
      
    }
    
    fetchRates();
  }, []);

  useEffect(() => {
    if (user?.currency) {
      setCurrency(normalizeCurrency(user.currency));
    }
  }, [user?.currency]);

  useEffect(() => {
    try {
      localStorage.setItem('csinvest:currency', currency);
    } catch (e) {
      // Ignore localStorage access errors.
    }
  }, [currency]);

  const fetchRates = async () => {
    setLoadingRates(true);
    const symbols = ['EUR','GBP','CZK','RUB'];
    const store = (obj) => {
      const merged = { ...FALLBACK_RATES, ...obj, USD: 1 };
      setRates(merged);
      const ts = Date.now();
      setLastUpdated(ts);
      localStorage.setItem('csinvest:fx', JSON.stringify({ timestamp: ts, rates: obj }));
    };
    try {
      
      const fetchJson = async (url) => {
        const r = await fetch(url);
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      };

      
      try {
        const data = await fetchJson(`https://api.exchangerate.host/latest?base=USD&symbols=${symbols.join(',')}`);
        const ratesObj = data?.rates || data?.data?.rates || null;
        if (ratesObj) {
          const picked = Object.fromEntries(symbols.map(s => [s, ratesObj[s]]).filter(([,v]) => typeof v === 'number'));
          if (Object.keys(picked).length) { store(picked); return; }
        }
        throw new Error('Malformed rate response');
      } catch (e1) {
        
        const data2 = await fetchJson('https://open.er-api.com/v6/latest/USD');
        const r2 = data2?.rates || data2?.conversion_rates || null;
        if (!r2) throw new Error('No rates from fallback');
        const picked2 = Object.fromEntries(symbols.map(s => [s, r2[s]]).filter(([,v]) => typeof v === 'number'));
        if (!Object.keys(picked2).length) throw new Error('Missing symbols in fallback');
        store(picked2);
      }
    } catch (e) {
      console.warn('FX fetch failed, using fallback:', e.message);
    } finally {
      setLoadingRates(false);
    }
  };

  const formatPrice = useCallback((value) => {
    if (value == null || isNaN(value)) return '—';
    const rate = rates[currency] || 1;
    const converted = (parseFloat(value) * rate);

    return SYMBOLS[currency] + converted.toFixed(2);
  }, [currency, rates]);

  const persistCurrency = useCallback(async (nextCurrency) => {
    if (!user?.user_id) return;

    const token = localStorage.getItem('csinvest:token');
    if (!token) return;

    try {
      const res = await fetch(`${API_BASE}/users/me`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ currency: nextCurrency }),
      });

      if (!res.ok) return;

      const updatedUser = await res.json();
      if (updatedUser?.user_id) {
        setUser(updatedUser);
      }
    } catch (e) {
      // Keep UI responsive even if persisting fails.
    }
  }, [user?.user_id, setUser]);

  const cycleCurrency = useCallback(() => {
    setCurrency(prev => {
      const idx = ORDER.indexOf(prev);
      const next = ORDER[(idx + 1) % ORDER.length];
      void persistCurrency(next);
      return next;
    });
  }, [persistCurrency]);

  const refreshRates = () => fetchRates();

  return (
    <CurrencyContext.Provider value={{
      currency,
      setCurrency,
      formatPrice,
      cycleCurrency,
      refreshRates,
      rates,
      lastUpdated,
      loadingRates,
    }}>
      {children}
    </CurrencyContext.Provider>
  );
};

export const useCurrency = () => useContext(CurrencyContext);
