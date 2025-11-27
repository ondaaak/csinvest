import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

// Fallback static approximate FX rates (base = USD) used until live fetch succeeds.
const FALLBACK_RATES = {
  USD: 1,
  EUR: 0.92,   // Euro
  GBP: 0.79,   // British Pound
  CZK: 23.00,  // Czech Koruna
  RUB: 92.00,  // Russian Ruble
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
    try {
      // Using exchangerate.host free endpoint
      const symbols = ['EUR','GBP','CZK','RUB'].join(',');
      const resp = await fetch(`https://api.exchangerate.host/latest?base=USD&symbols=${symbols}`);
      if (!resp.ok) throw new Error('Rate API failed: ' + resp.status);
      const data = await resp.json();
      if (!data || !data.rates) throw new Error('Malformed rate response');
      const merged = { ...FALLBACK_RATES, ...data.rates, USD: 1 };
      setRates(merged);
      const ts = Date.now();
      setLastUpdated(ts);
      localStorage.setItem('csinvest:fx', JSON.stringify({ timestamp: ts, rates: data.rates }));
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
