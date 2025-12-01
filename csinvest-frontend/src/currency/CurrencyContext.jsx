import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

// Fallback static approximate FX rates (base = USD) used until live fetch succeeds.
const FALLBACK_RATES = {
  USD: 1,
  EUR: 0.86,   // Euro
  GBP: 0.75,   // British Pound
  CZK: 20.77,  // Czech Koruna
  RUB: 77.73,  // Russian Ruble
};

const SYMBOLS = {
  USD: '$',
  EUR: '€',
  GBP: '£',
  CZK: 'Kč',
  RUB: '₽',
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
  const [currency, setCurrency] = useState('USD');
  const [rates, setRates] = useState(FALLBACK_RATES);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [loadingRates, setLoadingRates] = useState(false);

  // Load cached rates if present & fresh (< 12h old)
  useEffect(() => {
    try {
      const cached = localStorage.getItem('csinvest:fx');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed.timestamp && Date.now() - parsed.timestamp < 12 * 60 * 60 * 1000 && parsed.rates) {
          setRates({ ...FALLBACK_RATES, ...parsed.rates });
          setLastUpdated(parsed.timestamp);
          return; // skip immediate fetch
        }
      }
    } catch (e) {
      // ignore cache errors
    }
    // fetch immediately if no valid cache
    fetchRates();
  }, []);

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
      // Helper: fetch JSON and throw on HTTP error
      const fetchJson = async (url) => {
        const r = await fetch(url);
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      };

      // 1) Try exchangerate.host
      try {
        const data = await fetchJson(`https://api.exchangerate.host/latest?base=USD&symbols=${symbols.join(',')}`);
        const ratesObj = data?.rates || data?.data?.rates || null;
        if (ratesObj) {
          const picked = Object.fromEntries(symbols.map(s => [s, ratesObj[s]]).filter(([,v]) => typeof v === 'number'));
          if (Object.keys(picked).length) { store(picked); return; }
        }
        throw new Error('Malformed rate response');
      } catch (e1) {
        // 2) Fallback: open.er-api.com
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
    // For CZK & RUB often whole units feel better, but keep 2 decimals for consistency.
    return SYMBOLS[currency] + converted.toFixed(2);
  }, [currency, rates]);

  const ORDER = ['USD','EUR','GBP','CZK','RUB'];
  const cycleCurrency = () => {
    setCurrency(prev => {
      const idx = ORDER.indexOf(prev);
      const next = ORDER[(idx + 1) % ORDER.length];
      return next;
    });
  };

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
