import React, { useEffect, useState, useMemo, useRef } from 'react';
import AddItemModal from '../components/AddItemModal.jsx';
import axios from 'axios';
import { useCurrency } from '../currency/CurrencyContext.jsx';
import { useAuth } from '../auth/AuthContext.jsx';
import { useNavigate } from 'react-router-dom';
import { useAppModal } from '../components/AppModalProvider.jsx';

const BASE_URL = '/api';
const CURRENCY_SYMBOLS = {
  USD: '$',
  EUR: '€',
  GBP: '£',
  CZK: 'Kč',
  RUB: '₽',
};

const isDoppler = (nm) => nm && nm.includes('Doppler');

function InventoryPage() {
  const { userId, logout } = useAuth();
  const { formatPrice, currency, rates } = useCurrency();
  const { showAlert, showConfirm } = useAppModal();
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [soldItems, setSoldItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState('total'); 
  const [sortAsc, setSortAsc] = useState(false);
  const [viewMode, setViewMode] = useState('current');
  const [editing, setEditing] = useState({}); 
  const [buyMode, setBuyMode] = useState({}); 
  const [savingIds, setSavingIds] = useState(new Set()); 
  const [updatingIds, setUpdatingIds] = useState(new Set());
  const [sellingIds, setSellingIds] = useState(new Set());

  const [sellFeePct, setSellFeePct] = useState(2); 
  const [withdrawFeePct, setWithdrawFeePct] = useState(2); 

  const [rawSellFee, setRawSellFee] = useState('2');
  const [rawWithdrawFee, setRawWithdrawFee] = useState('2');
  const round2 = (v) => Math.round((Number(v) || 0) * 100) / 100;
  const clampFeePct = (v) => round2(Math.max(0, Math.min(100, Number(v) || 0)));

  // Import images
  const skinsGlob = import.meta.glob('../assets/skins/*.{png,jpg,jpeg,svg,webp}', { eager: true, query: '?url', import: 'default' });
  const glovesGlob = import.meta.glob('../assets/gloves/*.{png,jpg,jpeg,svg,webp}', { eager: true, query: '?url', import: 'default' });
  const casesGlob = import.meta.glob('../assets/cases/*.{png,jpg,jpeg,svg,webp}', { eager: true, query: '?url', import: 'default' });
  const charmsGlob = import.meta.glob('../assets/charms/*.{png,jpg,jpeg,svg,webp}', { eager: true, query: '?url', import: 'default' });
  const assetFromFolder = (globObj) => Object.fromEntries(
    Object.entries(globObj).map(([p, url]) => {
      const filename = p.split('/').pop() || '';
      const keyRaw = filename.substring(0, filename.lastIndexOf('.'));
      return [keyRaw.toLowerCase(), url];
    })
  );
  const itemThumbs = useMemo(() => ({
    ...assetFromFolder(skinsGlob),
    ...assetFromFolder(glovesGlob),
    ...assetFromFolder(casesGlob),
    ...assetFromFolder(charmsGlob),
  }), []);

  const sortedKeys = useMemo(() => {
    return Object.keys(itemThumbs).sort((a, b) => b.length - a.length);
  }, [itemThumbs]);

  const getImage = (slug, itemName) => {
    // 1. Try simple slug match
    if (slug) {
      const s = slug.toLowerCase();
      if (itemThumbs[s]) return itemThumbs[s];

      // 2. Try prefix match on slug
      const match = sortedKeys.find(key => s.startsWith(key));
      if (match) return itemThumbs[match];
      
      // 3. Reverse match (key starts with slug? rare but possible if slug is short)
      const reverseMatch = sortedKeys.find(key => key.startsWith(s));
      if (reverseMatch) return itemThumbs[reverseMatch];
    }

    // 4. Fallback: aggressive name matching (port from Modal logic)
    if (itemName) {
      const base = itemName.toLowerCase()
        .replace(/[|]+/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");
      if (itemThumbs[base]) return itemThumbs[base];
      
      // 5. Try to find if the cleaned name is contained in keys or vice versa
      const nameMatch = sortedKeys.find(key => base.includes(key) || key.includes(base));
      if (nameMatch) return itemThumbs[nameMatch];
    }
    
    return null;
  };

  const parseFee = (val) => {
    if (val === '' || val === null || val === undefined) return 0;
    const cleaned = String(val).replace(',', '.');
    const num = parseFloat(cleaned);
    if (isNaN(num)) return 0;
    return clampFeePct(num);
  };
  const normalizeOnBlur = (rawValue, setRaw, setNumeric, onNormalized) => {
    if (rawValue === '') { setNumeric(0); return; }
    const n = parseFee(rawValue);
    setNumeric(n);
    setRaw(n.toFixed(2));
    if (onNormalized) onNormalized(n);
  };
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAddSoldModal, setShowAddSoldModal] = useState(false);
  const [sellDialogItem, setSellDialogItem] = useState(null);
  const [sellDialogBuyPrice, setSellDialogBuyPrice] = useState('');
  const [sellDialogPrice, setSellDialogPrice] = useState('');
  const [sellDialogCurrency, setSellDialogCurrency] = useState(currency || 'USD');
  const [sellDialogDate, setSellDialogDate] = useState(new Date().toISOString().slice(0, 10));
  const [sellingNow, setSellingNow] = useState(false);
  const [soldEditing, setSoldEditing] = useState({});
  const [soldSavingIds, setSoldSavingIds] = useState(new Set());

  const [historyQuery, setHistoryQuery] = useState('');
  const [historySuggestions, setHistorySuggestions] = useState([]);
  const [historySuggestionsOpen, setHistorySuggestionsOpen] = useState(false);
  const [historySelected, setHistorySelected] = useState(null);
  const historySuggestRef = useRef(null);
  const [historyAmount, setHistoryAmount] = useState('1');
  const [historyBuyPrice, setHistoryBuyPrice] = useState('');
  const [historySellPrice, setHistorySellPrice] = useState('');
  const [historyDate, setHistoryDate] = useState(new Date().toISOString().slice(0, 10));
  const [historyCurrency, setHistoryCurrency] = useState(currency || 'USD');
  const [historySaving, setHistorySaving] = useState(false);
  const [historyError, setHistoryError] = useState('');
  const [infoItem, setInfoItem] = useState(null); // State for the item details modal
  const [notificationItem, setNotificationItem] = useState(null); // State for notification modal
  
  const [showPortfolioModal, setShowPortfolioModal] = useState(false);
  const [portfolioWebhook, setPortfolioWebhook] = useState('');
  const [portfolioNotificationTime, setPortfolioNotificationTime] = useState('');
  const actionsRef = useRef(null);
  const [controlsWidth, setControlsWidth] = useState(null);
  const summaryRef = useRef(null);
  const [isLowerHalf, setIsLowerHalf] = useState(false);

  const parsePrice = (val) => {
    if (val === '' || val === null || val === undefined) return 0;
    const cleaned = String(val).replace(/[^0-9.,-]/g, '').replace(',', '.');
    const num = parseFloat(cleaned);
    return Number.isFinite(num) ? num : 0;
  };

  const saveFeeSettings = async (nextSell, nextWithdraw) => {
    if (!userId) return;
    try {
      const token = localStorage.getItem('csinvest:token');
      await axios.patch(
        `${BASE_URL}/users/me`,
        {
          sell_fee_pct: clampFeePct(nextSell),
          withdraw_fee_pct: clampFeePct(nextWithdraw),
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
    } catch (e) {
      console.error('Failed to save fee settings', e);
    }
  };

  const bumpSellFee = (delta) => {
    const next = clampFeePct((Number(sellFeePct) || 0) + delta);
    setSellFeePct(next);
    setRawSellFee(next.toFixed(2));
    saveFeeSettings(next, withdrawFeePct);
  };

  const bumpWithdrawFee = (delta) => {
    const next = clampFeePct((Number(withdrawFeePct) || 0) + delta);
    setWithdrawFeePct(next);
    setRawWithdrawFee(next.toFixed(2));
    saveFeeSettings(sellFeePct, next);
  };

  useEffect(() => {
    if (!actionsRef.current || items.length === 0) return;

    const measure = () => {
      const w = actionsRef.current?.getBoundingClientRect?.().width;
      if (w && Number.isFinite(w)) {
        setControlsWidth(Math.round(w));
      }
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(actionsRef.current);
    window.addEventListener('resize', measure);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [items.length, loading]);

  useEffect(() => {
    const onScroll = () => {
      const doc = document.documentElement;
      const body = document.body;
      const docHeight = Math.max(body.scrollHeight, doc.scrollHeight);
      const maxScroll = Math.max(1, docHeight - window.innerHeight);
      const y = Math.max(0, window.scrollY || window.pageYOffset || 0);
      setIsLowerHalf(y >= maxScroll / 2);
    };

    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);

    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);

  useEffect(() => {
    if (!userId) return;
    const fetchFeeSettings = async () => {
      try {
        const token = localStorage.getItem('csinvest:token');
        const res = await axios.get(`${BASE_URL}/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
        const storedSell = clampFeePct(res.data?.sell_fee_pct ?? 2);
        const storedWithdraw = clampFeePct(res.data?.withdraw_fee_pct ?? 2);
        setSellFeePct(storedSell);
        setWithdrawFeePct(storedWithdraw);
        setRawSellFee(storedSell.toFixed(2));
        setRawWithdrawFee(storedWithdraw.toFixed(2));
      } catch (e) {
        console.error('Failed to load fee settings', e);
      }
    };

    fetchFeeSettings();
  }, [userId]);

  useEffect(() => {
    if (showPortfolioModal && userId) {
      const fetchMe = async () => {
        try {
           const token = localStorage.getItem('csinvest:token');
           const res = await axios.get(`${BASE_URL}/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
           setPortfolioWebhook(res.data.discord_portfolio_webhook_url || '');
           setPortfolioNotificationTime(res.data.discord_portfolio_notification_time || '');
        } catch(e) { console.error(e); }
      };
      fetchMe();
    }
  }, [showPortfolioModal, userId]);

  useEffect(() => {
    if (!showAddSoldModal) return;
    const q = historyQuery.trim();
    if (!q) {
      setHistorySuggestions([]);
      setHistorySuggestionsOpen(false);
      return;
    }

    const t = setTimeout(async () => {
      try {
        const res = await fetch(`${BASE_URL}/search?q=${encodeURIComponent(q)}&limit=8&exclude_item_type=collection`);
        if (!res.ok) {
          setHistorySuggestions([]);
          setHistorySuggestionsOpen(false);
          return;
        }
        const arr = await res.json();
        const suggestions = Array.isArray(arr) ? arr : [];
        setHistorySuggestions(suggestions);
        setHistorySuggestionsOpen(suggestions.length > 0);
      } catch {
        setHistorySuggestions([]);
        setHistorySuggestionsOpen(false);
      }
    }, 200);

    return () => clearTimeout(t);
  }, [historyQuery, showAddSoldModal]);

  useEffect(() => {
    if (!showAddSoldModal) return;
    const onMouseDown = (e) => {
      if (!historySuggestRef.current) return;
      if (!historySuggestRef.current.contains(e.target)) {
        setHistorySuggestionsOpen(false);
      }
    };
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [showAddSoldModal]);

  const handlePortfolioWebhookSave = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('csinvest:token');
      await axios.patch(`${BASE_URL}/users/me`, 
        { 
          discord_portfolio_webhook_url: portfolioWebhook || null,
          discord_portfolio_notification_time: portfolioNotificationTime || null
        }, 
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setShowPortfolioModal(false);
    } catch (err) {
      await showAlert('Failed to save portfolio webhook');
      console.error(err);
    }
  };

  const fetchItems = async () => {
    setLoading(true);
    try {
      if (!userId) {
        setItems([]);
        setLoading(false);
        return;
      }
      const res = await axios.get(`${BASE_URL}/portfolio/${userId}`);
      const arr = Array.isArray(res.data) ? res.data : [];
      const data = arr.map((item) => {
        const amt = typeof item.amount === 'number' ? item.amount : 1;
        return {
          ...item,
          profit: (item.current_price - item.buy_price) * amt,
        };
      });
      setItems(data);
    } catch (err) {
      console.error('Chyba načítání inventáře:', err);
    }
  };

  const fetchSoldItems = async () => {
    try {
      if (!userId) {
        setSoldItems([]);
        return;
      }
      const token = localStorage.getItem('csinvest:token');
      const res = await axios.get(`${BASE_URL}/useritemhistory`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const arr = Array.isArray(res.data) ? res.data : [];
      const data = arr.map((item) => {
        const amt = typeof item.amount === 'number' ? item.amount : 1;
        return {
          ...item,
          current_price: item.sell_price,
          profit: (item.sell_price - item.buy_price) * amt,
          sold_date: item.sold_date,
        };
      });
      setSoldItems(data);
    } catch (err) {
      console.error('Chyba načítání sold history:', err);
    }
  };

  const fetchAllInventoryData = async () => {
    setLoading(true);
    try {
      await Promise.all([fetchItems(), fetchSoldItems()]);
    } finally {
      setLoading(false);
    }
  };
  const reloadPrices = async () => {
    setLoading(true);
    try {
      if (!userId) throw new Error('Unauthenticated');
      await axios.post(`${BASE_URL}/refresh-portfolio/${userId}`);
      await fetchItems();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllInventoryData();
  }, [userId]);

    const saveEdit = async (id) => {
      const token = localStorage.getItem('csinvest:token');
      const payload = editing[id];
      if (!payload) return;
      if (savingIds.has(id)) return;
      setSavingIds(prev => new Set([...prev, id]));

      cancelEdit(id);
      const amt = Number(payload.amount) || 1;
      let buyUnit = Number(payload.buy_price);
      if (!Number.isFinite(buyUnit)) buyUnit = 0;
      if (buyMode[id] === 'total') {
        buyUnit = amt > 0 ? (buyUnit / amt) : buyUnit;
      }
      
      const rate = rates[currency] || 1;
      const buyPriceUSD = buyUnit / rate;

      try {
        const resp = await fetch(`${BASE_URL}/useritems/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            amount: amt,
            float_value: payload.float_value === '' ? null : Number(payload.float_value),
            pattern: payload.pattern === '' ? null : Number(payload.pattern),
            buy_price: buyPriceUSD,
          })
        });
        if (!resp.ok) {
          const text = await resp.text();
          console.error('Save failed:', text);
          if (resp.status === 401 || resp.status === 403) {
            await showAlert('Session expired. Please login again.');
            logout();
            navigate('/login');
            return;
          }
          await showAlert(`Saving failed: ${text}`);
          return;
        }

        await fetchItems();
      } catch (e) {
        console.error('Save failed', e);
        await showAlert(`Saving failed: ${e.message || e}`);
      } finally {
        setSavingIds(prev => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }
    };
  const getProfitPct = (it) => {
    const amt = getAmount(it);
    const denom = (it.buy_price * amt) || 0.000001;
    return (it.profit / denom) * 100;
  };

  const getAmount = (it) => {
    const amt = it?.amount;
    if (typeof amt === 'number' && !Number.isNaN(amt) && amt > 0) return amt;
    return 1;
  };

  const filtered = items.filter((it) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    const name = (it.item?.name || '').toLowerCase();
    const slug = (it.slug || '').toLowerCase();
    return name.includes(q) || slug.includes(q);
  });

  const filteredSold = soldItems.filter((it) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    const name = (it.item?.name || '').toLowerCase();
    const slug = (it.item?.slug || it.slug || '').toLowerCase();
    return name.includes(q) || slug.includes(q);
  });

  const startEdit = (item) => {
    const id = item.user_item_id;
    const rate = rates[currency] || 1;
    setEditing((prev) => ({
      ...prev,
      [id]: {
        amount: getAmount(item),
        float_value: item.float_value ?? '',
        pattern: item.pattern ?? '',
        buy_price: ((item.buy_price ?? 0) * rate).toFixed(2),
      },
    }));
    setBuyMode((prev) => ({ ...prev, [id]: prev[id] || 'unit' }));
  };

  const cancelEdit = (id) => {
    setEditing((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const sorted = [...filtered].sort((a, b) => {
    // Cash item always at the bottom if it ends up in this list (fallback)
    if (a.slug === 'cash' || a.item?.name?.toLowerCase() === 'cash') return 1;
    if (b.slug === 'cash' || b.item?.name?.toLowerCase() === 'cash') return -1;

    const dir = sortAsc ? 1 : -1;
    switch (sortKey) {
      case 'amount':
        return (getAmount(a) - getAmount(b)) * dir;
      case 'name':
        return (a.item?.name || '').localeCompare(b.item?.name || '') * dir;
      case 'buyUnit':
        return (a.buy_price - b.buy_price) * dir;
      case 'sellUnit':
        return (a.current_price - b.current_price) * dir;
      case 'total':
        return ((a.current_price * getAmount(a)) - (b.current_price * getAmount(b))) * dir;
      case 'profit':
        return (a.profit - b.profit) * dir;
      case 'profitPct':
        return (getProfitPct(a) - getProfitPct(b)) * dir;
      default:
        return 0;
    }
  });

  const sortedSold = [...filteredSold].sort((a, b) => {
    const dir = sortAsc ? 1 : -1;
    switch (sortKey) {
      case 'date': {
        const ad = a.sold_date ? new Date(a.sold_date).getTime() : 0;
        const bd = b.sold_date ? new Date(b.sold_date).getTime() : 0;
        return (ad - bd) * dir;
      }
      case 'amount':
        return (getAmount(a) - getAmount(b)) * dir;
      case 'name':
        return (a.item?.name || '').localeCompare(b.item?.name || '') * dir;
      case 'buyUnit':
        return ((a.buy_price || 0) - (b.buy_price || 0)) * dir;
      case 'sellUnit':
        return ((a.sell_price || 0) - (b.sell_price || 0)) * dir;
      case 'total':
        return (((a.sell_price || 0) * getAmount(a)) - ((b.sell_price || 0) * getAmount(b))) * dir;
      case 'profit':
        return ((a.profit || 0) - (b.profit || 0)) * dir;
      case 'profitPct': {
        const ap = ((a.profit || 0) / (((a.buy_price || 0) * getAmount(a)) || 0.000001)) * 100;
        const bp = ((b.profit || 0) / (((b.buy_price || 0) * getAmount(b)) || 0.000001)) * 100;
        return (ap - bp) * dir;
      }
      default:
        return 0;
    }
  });

  const getCurrentTotal = (it) => (it.current_price || 0) * getAmount(it);

  const formatInputPrice = (value) => {
    const n = Number(value);
    if (!Number.isFinite(n)) return '—';
    const symbol = CURRENCY_SYMBOLS[currency] || '$';
    return `${symbol}${n.toFixed(2)}`;
  };

  const openItem = (itm) => {
    if (!itm) return;
    
    // Redirect package to collection if collection info is available
    if (itm.item_type === 'case' && itm.collection_item?.slug) {
        navigate(`/collection/${itm.collection_item.slug}`);
        return;
    }
    
    const path = itm.item_type === 'case' ? `/case/${itm.slug}` : `/skin/${itm.slug}`;
    navigate(path);
  };

  const requestSort = (key) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(true);
    }
  };

  const switchToCurrent = () => {
    setViewMode('current');
    setSortKey('total');
    setSortAsc(false);
  };

  const switchToSold = () => {
    setViewMode('sold');
    setSortKey('date');
    setSortAsc(false);
  };

  const openSellDialog = (item) => {
    const rate = rates[currency] || 1;
    setSellDialogItem(item);
    setSellDialogBuyPrice(((item.buy_price || 0) * rate).toFixed(2));
    setSellDialogPrice(((item.current_price || 0) * rate).toFixed(2));
    setSellDialogCurrency(currency || 'USD');
    setSellDialogDate(new Date().toISOString().slice(0, 10));
  };

  const submitSellDialog = async (e) => {
    e.preventDefault();
    if (!sellDialogItem) return;
    const userItemId = sellDialogItem.user_item_id;
    if (!userItemId) return;

    const rate = rates[sellDialogCurrency] || 1;
    const buyPriceUsd = parsePrice(sellDialogBuyPrice) / rate;
    const sellPriceUsd = parsePrice(sellDialogPrice) / rate;
    const token = localStorage.getItem('csinvest:token');
    setSellingNow(true);
    setSellingIds((prev) => new Set([...prev, userItemId]));
    try {
      await axios.post(
        `${BASE_URL}/useritems/${userItemId}/sell`,
        { buy_price: buyPriceUsd, sell_price: sellPriceUsd, sold_date: sellDialogDate || null },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setSellDialogItem(null);
      await fetchAllInventoryData();
    } catch (err) {
      console.error(err);
      await showAlert('Failed to move item to sold history.');
    } finally {
      setSellingNow(false);
      setSellingIds((prev) => {
        const next = new Set(prev);
        next.delete(userItemId);
        return next;
      });
    }
  };

  const cycleSellDialogCurrency = () => {
    const keys = Object.keys(rates);
    const idx = keys.indexOf(sellDialogCurrency);
    const next = keys[(idx + 1) % keys.length];
    setSellDialogCurrency(next);
  };

  const cycleHistoryCurrency = () => {
    const keys = Object.keys(rates);
    const idx = keys.indexOf(historyCurrency);
    const next = keys[(idx + 1) % keys.length];
    setHistoryCurrency(next);
  };

  const openAddSoldModal = () => {
    setHistoryQuery('');
    setHistorySuggestions([]);
    setHistorySuggestionsOpen(false);
    setHistorySelected(null);
    setHistoryAmount('1');
    setHistoryBuyPrice('');
    setHistorySellPrice('');
    setHistoryDate(new Date().toISOString().slice(0, 10));
    setHistoryCurrency(currency || 'USD');
    setHistoryError('');
    setShowAddSoldModal(true);
  };

  const submitAddSoldItem = async (e) => {
    e.preventDefault();
    if (!historySelected?.item_id) {
      setHistoryError('Select an item name first.');
      return;
    }

    const amount = Math.max(1, Number(historyAmount) || 1);
    const rate = rates[historyCurrency] || 1;
    const buyPriceUsd = parsePrice(historyBuyPrice) / rate;
    const sellPriceUsd = parsePrice(historySellPrice) / rate;
    const token = localStorage.getItem('csinvest:token');

    setHistorySaving(true);
    setHistoryError('');
    try {
      await axios.post(
        `${BASE_URL}/useritemhistory`,
        {
          item_id: historySelected.item_id,
          amount,
          buy_price: buyPriceUsd,
          sell_price: sellPriceUsd,
          sold_date: historyDate || null,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setShowAddSoldModal(false);
      await fetchSoldItems();
    } catch (err) {
      console.error(err);
      setHistoryError('Failed to save sold item.');
    } finally {
      setHistorySaving(false);
    }
  };

  const startSoldEdit = (item) => {
    const id = item.user_item_history_id;
    const rate = rates[currency] || 1;
    setSoldEditing((prev) => ({
      ...prev,
      [id]: {
        sold_date: item.sold_date || new Date().toISOString().slice(0, 10),
        amount: getAmount(item),
        buy_price: ((item.buy_price || 0) * rate).toFixed(2),
        sell_price: ((item.sell_price || 0) * rate).toFixed(2),
      },
    }));
  };

  const cancelSoldEdit = (id) => {
    setSoldEditing((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const saveSoldEdit = async (id) => {
    const payload = soldEditing[id];
    if (!payload) return;
    if (soldSavingIds.has(id)) return;
    setSoldSavingIds((prev) => new Set([...prev, id]));
    const token = localStorage.getItem('csinvest:token');
    const rate = rates[currency] || 1;

    try {
      await axios.patch(
        `${BASE_URL}/useritemhistory/${id}`,
        {
          sold_date: payload.sold_date || null,
          amount: Math.max(1, Number(payload.amount) || 1),
          buy_price: parsePrice(payload.buy_price) / rate,
          sell_price: parsePrice(payload.sell_price) / rate,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      cancelSoldEdit(id);
      await fetchSoldItems();
    } catch (err) {
      console.error(err);
      await showAlert('Failed to update sold item.');
    } finally {
      setSoldSavingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const deleteSoldItem = async (id) => {
    if (!(await showConfirm('Delete this sold item?', { title: 'Delete sold item', confirmText: 'Delete' }))) return;
    try {
      const token = localStorage.getItem('csinvest:token');
      await axios.delete(`${BASE_URL}/useritemhistory/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      await fetchSoldItems();
    } catch (err) {
      console.error(err);
      await showAlert('Failed to delete sold item.');
    }
  };

  const Arrow = ({ keyName }) => (
    <span className="sort-arrow">{sortKey === keyName ? (sortAsc ? '↑' : '↓') : ''}</span>
  );

  const SwitchArrowsIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M7 7h10" />
      <path d="M15 5l2 2-2 2" />
      <path d="M17 17H7" />
      <path d="M9 19l-2-2 2-2" />
    </svg>
  );

  const PencilIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 20h9" />
      <path d="M16.5 3.5l4 4-11 11H5v-4z" />
    </svg>
  );
  const SaveIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="20 6 9 17 4 12"></polyline>
    </svg>
  );
  const CancelIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M18 6L6 18" />
      <path d="M6 6l12 12" />
    </svg>
  );
  const TrashIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
      <path d="M5 6l1 14a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1l1-14" />
    </svg>
  );
  const ToggleIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {/* rightward arrow on top */}
      <path d="M7 7h10" />
      <path d="M15 5l2 2-2 2" />
      {/* leftward arrow on bottom */}
      <path d="M17 17H7" />
      <path d="M9 19l-2-2 2-2" />
    </svg>
  );

  const InfoIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"></circle>
      <line x1="12" y1="16" x2="12" y2="12"></line>
      <line x1="12" y1="8" x2="12.01" y2="8"></line>
    </svg>
  );

  const RefreshIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 4v6h-6"></path>
      <path d="M1 20v-6h6"></path>
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
    </svg>
  );

  const BellIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
      <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
    </svg>
  );

  const DollarIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="12" y1="2" x2="12" y2="22" />
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7H14.5a3.5 3.5 0 0 1 0 7H7" />
    </svg>
  );

  const WarningIcon = () => (
    <span style={{ 
      color: '#ff4d4d', 
      fontWeight: 'bold', 
      cursor: 'help',
      fontSize: '18px',
      marginLeft: 6,
      lineHeight: 1
    }}>!</span>
  );

  const isPriceOutdated = (dateString) => {
    if (!dateString) return true;
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return true;
    const diff = Date.now() - date.getTime();
    return diff > 24 * 60 * 60 * 1000; // older than 24 hours
  };

  const getWearName = (floatVal) => {
    if (floatVal === '' || floatVal === null || floatVal === undefined) return '';
    const n = Number(floatVal);
    if (isNaN(n)) return '';
    if (n < 0.07) return 'Factory New';
    if (n < 0.15) return 'Minimal Wear';
    if (n < 0.38) return 'Field-Tested';
    if (n < 0.45) return 'Well-Worn';
    return 'Battle-Scarred';
  };

  const handleInfoSave = async (e) => {
    e.preventDefault();
    if (!infoItem) return;

    let parsedFloat = null;
    if (String(infoItem.float_value ?? '').trim() !== '') {
      parsedFloat = Number(String(infoItem.float_value).replace(',', '.'));
      if (Number.isNaN(parsedFloat) || parsedFloat < 0 || parsedFloat > 1) {
        await showAlert('Float must be a number between 0 and 1.');
        return;
      }
    }
    
    // Construct payload for update
    // We only update float for now, description is placeholder
    const id = infoItem.user_item_id;
    const token = localStorage.getItem('csinvest:token');
    
    try {
      const resp = await fetch(`${BASE_URL}/useritems/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
            float_value: parsedFloat,
           description: infoItem.description || null,
           variant: infoItem.variant || null,
           phase: infoItem.phase || null 
        })
      });

      if (!resp.ok) {
        throw new Error('Failed to update details');
      }

      await fetchItems();
      setInfoItem(null); // Close modal
    } catch (err) {
      await showAlert(err.message || 'Failed to update details');
    }
  };

  const handleNotificationSave = async (e) => {
    e.preventDefault();
    if (!notificationItem) return;

    const id = notificationItem.user_item_id;
    const token = localStorage.getItem('csinvest:token');

    try {
      const resp = await fetch(`${BASE_URL}/useritems/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          discord_webhook_url: notificationItem.discord_webhook_url || null
        })
      });

      if (!resp.ok) {
        throw new Error('Failed to update notification settings');
      }

      await fetchItems();
      setNotificationItem(null);
    } catch (err) {
      await showAlert(err.message || 'Failed to update notification settings');
    }
  };

  const handleRefreshPrice = async (item) => {
    if (!item?.user_item_id) return;
    const uid = item.user_item_id;
    if (updatingIds.has(uid)) return;

    setUpdatingIds(prev => new Set([...prev, uid]));
    try {
      const token = localStorage.getItem('csinvest:token');
      await axios.post(
        `${BASE_URL}/useritems/${uid}/refresh`,
        {},
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      await fetchItems();
    } catch (e) {
      console.error(e);
      await showAlert('Price refresh failed');
    } finally {
      setUpdatingIds(prev => {
        const next = new Set(prev);
        next.delete(uid);
        return next;
      });
    }
  };



  // Separate Cash item from standard items
  // Handle multiple cash items by summing them up
  const cashItems = items.filter(i => i.slug === 'cash' || i.item?.name?.toLowerCase() === 'cash');
  let cashItem = null;
  if (cashItems.length > 0) {
    // If multiple cash items, create a synthetic combined one
    const totalCashVal = cashItems.reduce((acc, c) => acc + (c.buy_price * getAmount(c)), 0);
    // Use the first one as a base for ID/updates, but ideally we should merge them in backend.
    // For now, let's just use the first item and display the total value.
    // Note: Editing this 'merged' item will only update the first database row. 
    // This isn't perfect for duplicates but handles display.
    cashItem = { ...cashItems[0], buy_price: totalCashVal, amount: 1 };
  }
  
  const displayItems = sorted.filter(i => i.slug !== 'cash' && i.item?.name?.toLowerCase() !== 'cash');
  const displaySoldItems = sortedSold;
  const hasActiveRows = viewMode === 'current' ? items.length > 0 : soldItems.length > 0;

  const handleInventoryJump = () => {
    if (isLowerHalf) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    if (summaryRef.current) {
      summaryRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }

    window.scrollTo({
      top: Math.max(document.body.scrollHeight, document.documentElement.scrollHeight),
      behavior: 'smooth',
    });
  };

  return (
    <div className="dashboard-container inventory-page" style={{ maxWidth: '1400px' }}>
      <div style={{ display:'flex', justifyContent:'center', alignItems:'center', gap:10, marginBottom:8 }}>
        <button
          type="button"
          className="link-btn"
          onClick={() => (viewMode === 'current' ? switchToCurrent() : switchToSold())}
          style={{ fontSize:'1.15rem', fontWeight:700, opacity:1 }}
        >
          {viewMode === 'current' ? 'Current Items' : 'Sold Items'}
        </button>
        <button
          type="button"
          className="icon-btn"
          onClick={() => (viewMode === 'current' ? switchToSold() : switchToCurrent())}
          title="Switch view"
        >
          <SwitchArrowsIcon />
        </button>
        <button
          type="button"
          className="link-btn"
          onClick={() => (viewMode === 'current' ? switchToSold() : switchToCurrent())}
          style={{ fontSize:'0.88rem', fontWeight:500, opacity:0.75 }}
        >
          {viewMode === 'current' ? 'Sold Items' : 'Current Items'}
        </button>
      </div>
      {hasActiveRows && (
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <input
            className="search-input"
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: controlsWidth ? `${controlsWidth}px` : 'min(600px, 90vw)', maxWidth: '90vw' }}
          />
        </div>
      )}
      {userId && viewMode === 'sold' && hasActiveRows && (
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 12 }}>
          <button
            className="account-button inventory-main-action"
            onClick={openAddSoldModal}
            style={{ fontSize: '0.95rem', padding: '10px 18px' }}
          >
            Add New Item
          </button>
        </div>
      )}

      <div className="inventory-actions">
        {userId && viewMode === 'current' && items.length > 0 && (
          <div ref={actionsRef} className="inventory-actions-group">
            <button
              className="account-button inventory-main-action"
              onClick={() => setShowAddModal(true)}
            >
              Add New Item
            </button>
            <button className="account-button inventory-main-action" onClick={reloadPrices} disabled={loading}>
              {loading ? 'Loading…' : 'Reload Prices ↻'}
            </button>
            <button className="account-button inventory-main-action" onClick={() => setShowPortfolioModal(true)} style={{ marginLeft: 8 }} title="Portfolio-wide notifications">
              Portfolio Updates 🔔
            </button>
          </div>
        )}
      </div>

      {userId && hasActiveRows && (
        <button
          type="button"
          className="inventory-jump-btn"
          onClick={handleInventoryJump}
          title={isLowerHalf ? 'Scroll to top' : 'Scroll to totals'}
          aria-label={isLowerHalf ? 'Scroll to top' : 'Scroll to totals'}
          style={{ transform: `translateY(-50%) rotate(${isLowerHalf ? 180 : 0}deg)` }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
      )}

      <div className={userId && hasActiveRows ? "blur-container" : ""}>
        {userId ? (
          hasActiveRows ? (
        <div className="inventory-table-wrap">
        <table>
        <thead>
          <tr>
            {viewMode === 'sold' && <th className="sortable" onClick={() => requestSort('date')}>Date <Arrow keyName="date" /></th>}
            <th className="sortable" onClick={() => requestSort('amount')}>Amount <Arrow keyName="amount" /></th>
            <th style={{ width: 50 }}></th>
            <th className="sortable" onClick={() => requestSort('name')}>Name <Arrow keyName="name" /></th>
            <th className="sortable" onClick={() => requestSort('buyUnit')}>Buy (unit) <Arrow keyName="buyUnit" /></th>
            <th className="sortable" onClick={() => requestSort('sellUnit')}>{viewMode === 'current' ? 'Sell (unit)' : 'Sold (unit)'} <Arrow keyName="sellUnit" /></th>
            <th className="sortable" onClick={() => requestSort('total')}>Total (all) <Arrow keyName="total" /></th>
            <th className="sortable" onClick={() => requestSort('profit')}>Profit <Arrow keyName="profit" /></th>
            <th className="sortable" onClick={() => requestSort('profitPct')}>Profit% <Arrow keyName="profitPct" /></th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {viewMode === 'current' && displayItems.map((item) => (
            <tr key={item.user_item_id}>
              <td>
                {editing[item.user_item_id] ? (
                  <input className="form-input" style={{ maxWidth: 80 }} value={editing[item.user_item_id].amount}
                    onChange={(e) => setEditing((prev) => ({ ...prev, [item.user_item_id]: { ...prev[item.user_item_id], amount: e.target.value } }))} />
                ) : (
                  getAmount(item)
                )}
              </td>
              <td style={{ padding: '4px 8px' }}>
                {(() => {
                   const imgUrl = item.item?.image || getImage(item.slug, item.item?.name);
                   return imgUrl ? (
                     <img src={imgUrl} alt="" style={{ width: 40, height: 40, objectFit: 'contain' }} />
                   ) : null;
                })()}
              </td>
              <td>
                {item.item ? (
                  <button className="link-btn" onClick={() => openItem(item.item)}>
                    {item.variant ? (
                      <span style={{ color: item.variant === 'StatTrak™' ? '#cf6a32' : '#ffd700', marginRight: 4 }}>
                        {item.variant}
                      </span>
                    ) : null}
                    {item.item.name}
                    {item.phase ? (
                      <span style={{ color: '#ff00aa', marginLeft: 4 }}>
                         ({item.phase})
                      </span>
                    ) : null}
                  </button>
                ) : '—'}
              </td>
              <td>
                {editing[item.user_item_id] ? (
                  <div>
                    <div style={{ display:'flex', alignItems:'center' }}>
                      <input 
                        className="form-input compact" 
                        style={{ width: 80, height: 30, marginRight: 6 }} 
                        value={editing[item.user_item_id].buy_price}
                        onChange={(e) => setEditing((prev) => ({ ...prev, [item.user_item_id]: { ...prev[item.user_item_id], buy_price: e.target.value } }))} 
                      />
                      <button className="icon-btn toggle-btn" title={`Input is ${buyMode[item.user_item_id] === 'total' ? 'Total' : 'Unit'} price. Click to swap.`} aria-label="Toggle unit or total"
                        onClick={() => setBuyMode((prev) => ({ ...prev, [item.user_item_id]: (prev[item.user_item_id] === 'total' ? 'unit' : 'total') }))}>
                        <ToggleIcon />
                      </button>
                    </div>
                    <div style={{ fontSize:'0.75rem', opacity:0.7, marginTop:2 }}>
                      {buyMode[item.user_item_id] === 'total'
                        ? `Unit: ${formatInputPrice(((Number(editing[item.user_item_id].buy_price) || 0) / (Number(editing[item.user_item_id].amount) || 1)) || 0)}`
                        : `Total: ${formatInputPrice((Number(editing[item.user_item_id].buy_price) || 0) * (Number(editing[item.user_item_id].amount) || 1))}`}
                    </div>
                  </div>
                ) : (
                  <>
                    {savingIds.has(item.user_item_id) && <span className="spinner" title="Saving" aria-label="Saving" style={{ marginRight: 6 }} />}
                    {formatPrice(item.buy_price)}
                  </>
                )}
              </td>
              <td title={`last update: ${(() => { const d = item.last_update || item.item?.last_update; try { return d ? new Date(d).toLocaleString() : '—'; } catch { return '—'; } })()}`}>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  {formatPrice(item.current_price)}
                  {isPriceOutdated(item.last_update || item.item?.last_update) && (
                    <div title="Price outdated (>24h)">
                      <WarningIcon />
                    </div>
                  )}
                </div>
              </td>
              <td>{formatPrice(getCurrentTotal(item))}</td>
              <td className={item.profit >= 0 ? 'profit-text' : 'loss-text'}>
                {formatPrice(item.profit)}
              </td>
              <td className={item.profit >= 0 ? 'profit-text' : 'loss-text'}>
                {getProfitPct(item).toFixed(2)}%
              </td>
              <td>
                {editing[item.user_item_id] ? (
                  <>
                    <button className="icon-btn" title="Save" onClick={() => saveEdit(item.user_item_id)} disabled={savingIds.has(item.user_item_id)}><SaveIcon /></button>
                    <button className="icon-btn" title="Cancel" onClick={() => cancelEdit(item.user_item_id)} disabled={savingIds.has(item.user_item_id)}><CancelIcon /></button>
                  </>
                ) : (
                  <>
                    <button className="icon-btn" title="Mark as sold" onClick={() => openSellDialog(item)} disabled={savingIds.has(item.user_item_id) || sellingIds.has(item.user_item_id)}><DollarIcon /></button>
                    <button className="icon-btn" title="Edit" onClick={() => startEdit(item)} disabled={savingIds.has(item.user_item_id)}><PencilIcon /></button>
                    {/* Info Action */}
                    <button className="icon-btn" title="Info & Details" onClick={() => setInfoItem({ ...item, float_value: item.float_value ?? '' })} disabled={savingIds.has(item.user_item_id)}>
                      <InfoIcon />
                    </button>

                    {/* Refresh Price */}
                    <button className="icon-btn" title="Refresh Price" onClick={() => handleRefreshPrice(item)} disabled={savingIds.has(item.user_item_id) || updatingIds.has(item.user_item_id)}>
                      {updatingIds.has(item.user_item_id) ? <span className="spinner" style={{width:14, height:14}}/> : <RefreshIcon />}
                    </button>

                    {/* Bell / Notify */}
                    <button className={`icon-btn ${item.discord_webhook_url ? 'active' : ''}`} title="Notification Settings" onClick={() => setNotificationItem(item)} disabled={savingIds.has(item.user_item_id)}>
                      <BellIcon style={{ color: item.discord_webhook_url ? '#f5a623' : 'currentColor' }} />
                    </button>

                    <button className="icon-btn" title="Delete" disabled={savingIds.has(item.user_item_id)} onClick={async () => {
                      if (!(await showConfirm('Are you sure you want to delete this item?', { title: 'Delete item',  }))) return;
                      try {
                        const token = localStorage.getItem('csinvest:token');
                        await fetch(`${BASE_URL}/useritems/${item.user_item_id}`, {
                          method: 'DELETE',
                          headers: { Authorization: `Bearer ${token}` },
                        });
                        await fetchItems();
                      } catch (e) {
                        console.error('Delete failed', e);
                      }
                    }}><TrashIcon /></button>
                  </>
                )}
              </td>
            </tr>
          ))}

          {viewMode === 'sold' && displaySoldItems.map((item) => {
            const rowEdit = soldEditing[item.user_item_history_id];
            const amount = rowEdit ? (Number(rowEdit.amount) || 1) : getAmount(item);
            const buyUnit = rowEdit ? Number(rowEdit.buy_price) || 0 : (item.buy_price || 0);
            const sellUnit = rowEdit ? Number(rowEdit.sell_price) || 0 : (item.sell_price || 0);
            const soldTotal = sellUnit * amount;
            const buyTotal = buyUnit * amount;
            const profit = soldTotal - buyTotal;
            const profitPct = buyTotal > 0 ? (profit / buyTotal) * 100 : 0;
            return (
              <tr key={item.user_item_history_id}>
                <td>
                  {rowEdit ? (
                    <input
                      className="form-input"
                      type="date"
                      value={rowEdit.sold_date || ''}
                      onChange={(e) => setSoldEditing((prev) => ({ ...prev, [item.user_item_history_id]: { ...prev[item.user_item_history_id], sold_date: e.target.value } }))}
                    />
                  ) : (
                    item.sold_date ? new Date(item.sold_date).toLocaleDateString() : '—'
                  )}
                </td>
                <td>
                  {rowEdit ? (
                    <input
                      className="form-input"
                      style={{ maxWidth: 80 }}
                      value={rowEdit.amount}
                      onChange={(e) => setSoldEditing((prev) => ({ ...prev, [item.user_item_history_id]: { ...prev[item.user_item_history_id], amount: e.target.value } }))}
                    />
                  ) : (
                    getAmount(item)
                  )}
                </td>
                <td style={{ padding: '4px 8px' }}>
                  {(() => {
                    const imgUrl = item.item?.image || getImage(item.item?.slug || item.slug, item.item?.name);
                    return imgUrl ? (
                      <img src={imgUrl} alt="" style={{ width: 40, height: 40, objectFit: 'contain' }} />
                    ) : null;
                  })()}
                </td>
                <td>
                  {item.item ? (
                    <button className="link-btn" onClick={() => openItem(item.item)}>
                      {item.item.name}
                    </button>
                  ) : '—'}
                </td>
                <td>
                  {rowEdit ? (
                    <input
                      className="form-input compact"
                      style={{ width: 90 }}
                      value={rowEdit.buy_price}
                      onChange={(e) => setSoldEditing((prev) => ({ ...prev, [item.user_item_history_id]: { ...prev[item.user_item_history_id], buy_price: e.target.value } }))}
                    />
                  ) : (
                    formatPrice(item.buy_price)
                  )}
                </td>
                <td>
                  {rowEdit ? (
                    <input
                      className="form-input compact"
                      style={{ width: 90 }}
                      value={rowEdit.sell_price}
                      onChange={(e) => setSoldEditing((prev) => ({ ...prev, [item.user_item_history_id]: { ...prev[item.user_item_history_id], sell_price: e.target.value } }))}
                    />
                  ) : (
                    formatPrice(item.sell_price)
                  )}
                </td>
                <td>{formatPrice(soldTotal)}</td>
                <td className={profit >= 0 ? 'profit-text' : 'loss-text'}>{formatPrice(profit)}</td>
                <td className={profit >= 0 ? 'profit-text' : 'loss-text'}>{profitPct.toFixed(2)}%</td>
                <td>
                  {rowEdit ? (
                    <>
                      <button className="icon-btn" title="Save" onClick={() => saveSoldEdit(item.user_item_history_id)} disabled={soldSavingIds.has(item.user_item_history_id)}><SaveIcon /></button>
                      <button className="icon-btn" title="Cancel" onClick={() => cancelSoldEdit(item.user_item_history_id)} disabled={soldSavingIds.has(item.user_item_history_id)}><CancelIcon /></button>
                    </>
                  ) : (
                    <>
                      <button className="icon-btn" title="Edit" onClick={() => startSoldEdit(item)}><PencilIcon /></button>
                      <button className="icon-btn" title="Delete" onClick={() => deleteSoldItem(item.user_item_history_id)}><TrashIcon /></button>
                    </>
                  )}
                </td>
              </tr>
            );
          })}
          
          {/* Cash Row - Always at the bottom if it exists */}
          {viewMode === 'current' && cashItem && (
             <tr key={cashItem.user_item_id} style={{ borderTop: '2px solid #444', background: 'rgba(255, 255, 255, 0.05)' }}>
               <td></td>
               <td style={{ padding: '4px 8px' }}>
                 <div style={{ 
                   width: 32, 
                   height: 32, 
                   display: 'flex', 
                   alignItems: 'center', 
                   justifyContent: 'center',
                   background: '#1a1a1a', 
                   borderRadius: '50%',
                   color: '#eee',
                   border: '1px solid #333'
                 }}>
                   <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                     <path d="M20 12V8H6a2 2 0 0 1-2-2c0-1.1.9-2 2-2h12v4"></path>
                     <path d="M4 6v12c0 1.1.9 2 2 2h14v-4"></path>
                     <path d="M18 12a2 2 0 0 0-2 2c0 1.1.9 2 2 2h4v-4h-4z"></path>
                   </svg>
                 </div>
               </td>
               <td style={{ color: '#ffffff' }}>Cash</td>
               <td colSpan="2">
                 {/* Treating 'amount' as the cash value for simplicity, or we can use buy_price * amount. 
                     Let's stick to the convention: Amount is 1, and Price is the value. 
                     OR Amount is value and Price is 1. 
                     
                     User said: "uzivatel by si mohl zvolit kolik ma a prepisovat si to".
                     The easiest logic for 'Cash' is: Amount = 1, Buy Price = X, Current Price = X.
                 */}
                 {editing[cashItem.user_item_id] ? (
                    <div style={{ display:'flex', alignItems:'center' }}>
                      <input 
                        className="form-input compact" 
                        style={{ width: 100, height: 30, marginRight: 6 }} 
                        // editing uses 'buy_price' field
                        value={editing[cashItem.user_item_id].buy_price}
                        onChange={(e) => setEditing((prev) => ({ ...prev, [cashItem.user_item_id]: { ...prev[cashItem.user_item_id], buy_price: e.target.value } }))} 
                      />
                      <span style={{ fontSize: '0.8rem', opacity: 0.7 }}>{currency}</span>
                    </div>
                 ) : (
                    <span style={{ fontSize: '1em' }}>
                      {formatPrice(cashItem.buy_price)}
                    </span>
                 )}
               </td>
               <td>{formatPrice(cashItem.buy_price)}</td>{/* Total is same as Unit for cash if amount=1 */}
               <td></td>{/* No Profit */}
               <td></td>{/* No Profit % */}
               <td>
                {editing[cashItem.user_item_id] ? (
                  <>
                    <button className="icon-btn" title="Save" onClick={async () => {
                         // Special save for cash to ensure current_price matches buy_price logic
                         
                         // If we have multiple cash items (duplicates), we should merge them now.
                         // 1. Update the FIRST cash item to the new total value.
                         // 2. Delete all other cash items.
                         
                         const newTotal = editing[cashItem.user_item_id].buy_price;
                         const token = localStorage.getItem('csinvest:token');
                         const rate = rates[currency] || 1;
                         
                         // Update first item
                         await fetch(`${BASE_URL}/useritems/${cashItem.user_item_id}`, {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                            body: JSON.stringify({
                              amount: 1,
                              buy_price: (parseFloat(newTotal) || 0) / rate,
                            })
                         });
                         
                         // Delete duplicates
                         if (cashItems.length > 1) {
                            const duplicates = cashItems.slice(1);
                            for (const dup of duplicates) {
                                await fetch(`${BASE_URL}/useritems/${dup.user_item_id}`, {
                                  method: 'DELETE',
                                  headers: { Authorization: `Bearer ${token}` },
                                });
                            }
                         }

                         await fetchItems();
                         cancelEdit(cashItem.user_item_id);
                    }} disabled={savingIds.has(cashItem.user_item_id)}><SaveIcon /></button>
                    <button className="icon-btn" title="Cancel" onClick={() => cancelEdit(cashItem.user_item_id)} disabled={savingIds.has(cashItem.user_item_id)}><CancelIcon /></button>
                  </>
                ) : (
                  <>
                    <button className="icon-btn" title="Edit Amount" onClick={() => {
                          // Force amount to 1 for edits to keep it simple, edit price instead
                          const rate = rates[currency] || 1;
                          setEditing((prev) => ({
                            ...prev,
                            [cashItem.user_item_id]: {
                              amount: 1, 
                              float_value: '',
                              pattern: '',
                              buy_price: ((cashItem.buy_price ?? 0) * rate).toFixed(2),
                            },
                          }));
                          setBuyMode((prev) => ({ ...prev, [cashItem.user_item_id]: 'total' })); // doesn't matter for qty 1
                    }} disabled={savingIds.has(cashItem.user_item_id)}><PencilIcon /></button>
                    <button className="icon-btn" title="Delete Cash" disabled={savingIds.has(cashItem.user_item_id)} onClick={async () => {
                      if (!(await showConfirm('Delete cash item?', { title: 'Delete cash', confirmText: 'Delete' }))) return;
                      try {
                        const token = localStorage.getItem('csinvest:token');
                        for (const c of cashItems) {
                          await fetch(`${BASE_URL}/useritems/${c.user_item_id}`, {
                            method: 'DELETE',
                            headers: { Authorization: `Bearer ${token}` },
                          });
                        }
                        await fetchItems();
                      } catch (e) {
                        console.error('Delete cash failed', e);
                      }
                    }}><TrashIcon /></button>
                  </>
                )}
               </td>
             </tr>
          )}
        </tbody>
        </table>
        </div>
          ) : (
            !loading ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                <div className="loading">{viewMode === 'current' ? 'Portfolio is empty.' : 'Item history is empty.'}</div>
                <button
                  className="account-button inventory-main-action"
                  onClick={() => (viewMode === 'current' ? setShowAddModal(true) : openAddSoldModal())}
                  style={{ fontSize: '1rem', padding: '14px 24px' }}
                >
                  Add New Item
                </button>
              </div>
            ) : null
          )
        ) : (
          null
        )}
      </div>

      {/* Portfolio summary */}
      {viewMode === 'current' && items.length > 0 && (
        <div ref={summaryRef} style={{ marginTop: 24 }}>
          {(() => {
            const totals = displayItems.reduce((acc, it) => {
              const amt = getAmount(it);
              const buyT = (it.buy_price || 0) * amt;
              const sellT = (it.current_price || 0) * amt;
              acc.buy += buyT;
              acc.sell += sellT;
              return acc;
            }, { buy: 0, sell: 0 });
            
            // Add Cash to totals (only adds to Value, not really profit? Or adds to both?)
            // Usually cash is: Deposit = X, Value = X. Profit = 0.
            const cashValue = cashItem ? (cashItem.buy_price || 0) * getAmount(cashItem) : 0;
            
            // Raw totals with cash included
            const totalBuyWithCash = totals.buy + cashValue;
            const totalSellWithCash = totals.sell + cashValue;

            const profit = totalSellWithCash - totalBuyWithCash;
            const profitPct = totalBuyWithCash > 0 ? (profit / totalBuyWithCash) * 100 : 0;

            const sellFeeRate = Math.max(0, Number(sellFeePct) || 0) / 100;
            // Fee applies ONLY to the invested items (totals.sell), NOT to cash
            const sellAfterFee = (totals.sell * (1 - sellFeeRate)) + cashValue;
            const profitAfterSellFee = sellAfterFee - totalBuyWithCash;
            const profitAfterSellFeePct = totalBuyWithCash > 0 ? (profitAfterSellFee / totalBuyWithCash) * 100 : 0;

            const withdrawFeeRate = Math.max(0, Number(withdrawFeePct) || 0) / 100;
            // Fee applies ONLY to the invested items (totals.sell), NOT to cash (assuming one withdraws cash 1:1 or fee logic is only for skin sales)
            // If withdraw fee is for cashing out everything including cash balance, then it should apply to everything.
            // User request: "kdyz ma clovek jen cash 100€ tak mu to po poplatcich dava 96€ ale on prece zadne poplatky platit nemusi kdyz ma cash u sebe"
            // So fees should NOT apply to cash.
            const withdrawAfterFee = (totals.sell * (1 - sellFeeRate) * (1 - withdrawFeeRate)) + cashValue;
            const profitAfterWithdrawFee = withdrawAfterFee - totalBuyWithCash;
            const profitAfterWithdrawFeePct = totalBuyWithCash > 0 ? (profitAfterWithdrawFee / totalBuyWithCash) * 100 : 0;

            const round2 = (v) => Math.round((Number(v) || 0) * 100) / 100;

            return (
              <div>
                <div className="stat-card summary-card">
                  <div className="inventory-summary-grid" style={{ display:'grid', alignItems:'center', gap: 4 }}>
                    <div className="inventory-summary-title" style={{ fontWeight: 600 }}>Market price</div>
                    <div>{/* spacer to align with fee input in other rows */}</div>
                    <div>
                      <div style={{ opacity:0.7 }}>Deposit</div>
                      <div>{formatPrice(totalBuyWithCash)}</div>
                    </div>
                    <div>
                      <div style={{ opacity:0.7 }}>Sell price</div>
                      <div>{formatPrice(totalSellWithCash)}</div>
                    </div>
                    <div>
                      <div style={{ opacity:0.7 }}>Profit</div>
                      <div className={profit >= 0 ? 'profit-text' : 'loss-text'}>{formatPrice(profit)}</div>
                    </div>
                    <div>
                      <div style={{ opacity:0.7 }}>Profit%</div>
                      <div className={profit >= 0 ? 'profit-text' : 'loss-text'}>{profitPct.toFixed(2)}%</div>
                    </div>
                  </div>
                </div>
                  <div className="stat-card summary-card">
                    <div className="inventory-summary-grid" style={{ display:'grid', alignItems:'center', gap: 4 }}>
                      <div className="inventory-summary-title" style={{ fontWeight: 600 }}>After sell fee</div>
                      <div className="inventory-fee-input" style={{ display:'flex', alignItems:'center', gap:6 }}>
                        <span style={{ opacity:0.7 }}>%</span>
                        <input
                          className="form-input no-spin"
                          type="text"
                          inputMode="decimal"
                          style={{ maxWidth: 90 }}
                          placeholder="0"
                          value={rawSellFee}
                          onChange={(e) => { setRawSellFee(e.target.value); setSellFeePct(parseFee(e.target.value)); }}
                          onBlur={() => normalizeOnBlur(rawSellFee, setRawSellFee, setSellFeePct, (n) => saveFeeSettings(n, withdrawFeePct))}
                        />
                        <div className="number-arrows">
                          <button type="button" onClick={() => bumpSellFee(0.1)}>▲</button>
                          <button type="button" onClick={() => bumpSellFee(-0.1)}>▼</button>
                        </div>
                      </div>
                      <div>
                        <div style={{ opacity:0.7 }}>Deposit</div>
                        <div>{formatPrice(totalBuyWithCash)}</div>
                      </div>
                      <div>
                        <div style={{ opacity:0.7 }}>Sell price</div>
                        <div>{formatPrice(sellAfterFee)}</div>
                      </div>
                      <div>
                        <div style={{ opacity:0.7 }}>Profit</div>
                        <div className={profitAfterSellFee >= 0 ? 'profit-text' : 'loss-text'}>{formatPrice(profitAfterSellFee)}</div>
                      </div>
                      <div>
                        <div style={{ opacity:0.7 }}>Profit%</div>
                        <div className={profitAfterSellFee >= 0 ? 'profit-text' : 'loss-text'}>{profitAfterSellFeePct.toFixed(2)}%</div>
                      </div>
                    </div>
                  </div>
                  <div className="stat-card summary-card">
                    <div className="inventory-summary-grid" style={{ display:'grid', alignItems:'center', gap: 4 }}>
                      <div className="inventory-summary-title" style={{ fontWeight: 600 }}>After withdraw fee</div>
                      <div className="inventory-fee-input" style={{ display:'flex', alignItems:'center', gap:6 }}>
                        <span style={{ opacity:0.7 }}>%</span>
                        <input
                          className="form-input no-spin"
                          type="text"
                          inputMode="decimal"
                          style={{ maxWidth: 90 }}
                          placeholder="0"
                          value={rawWithdrawFee}
                          onChange={(e) => { setRawWithdrawFee(e.target.value); setWithdrawFeePct(parseFee(e.target.value)); }}
                          onBlur={() => normalizeOnBlur(rawWithdrawFee, setRawWithdrawFee, setWithdrawFeePct, (n) => saveFeeSettings(sellFeePct, n))}
                        />
                        <div className="number-arrows">
                          <button type="button" onClick={() => bumpWithdrawFee(0.1)}>▲</button>
                          <button type="button" onClick={() => bumpWithdrawFee(-0.1)}>▼</button>
                        </div>
                      </div>
                      <div>
                        <div style={{ opacity:0.7 }}>Deposit</div>
                        <div>{formatPrice(totalBuyWithCash)}</div>
                      </div>
                      <div>
                        <div style={{ opacity:0.7 }}>Sell price</div>
                        <div>{formatPrice(withdrawAfterFee)}</div>
                      </div>
                      <div>
                        <div style={{ opacity:0.7 }}>Profit</div>
                        <div className={profitAfterWithdrawFee >= 0 ? 'profit-text' : 'loss-text'}>{formatPrice(profitAfterWithdrawFee)}</div>
                      </div>
                      <div>
                        <div style={{ opacity:0.7 }}>Profit%</div>
                        <div className={profitAfterWithdrawFee >= 0 ? 'profit-text' : 'loss-text'}>{profitAfterWithdrawFeePct.toFixed(2)}%</div>
                      </div>
                    </div>
                  </div>

                
              </div>
            );
          })()}
        </div>
      )}

      {viewMode === 'sold' && soldItems.length > 0 && (
        <div ref={summaryRef} style={{ marginTop: 24 }}>
          {(() => {
            const totals = displaySoldItems.reduce((acc, it) => {
              const amt = getAmount(it);
              acc.buy += (it.buy_price || 0) * amt;
              acc.sell += (it.sell_price || 0) * amt;
              return acc;
            }, { buy: 0, sell: 0 });

            const profit = totals.sell - totals.buy;
            const profitPct = totals.buy > 0 ? (profit / totals.buy) * 100 : 0;

            return (
              <div className="stat-card summary-card">
                <div className="inventory-summary-grid" style={{ display:'grid', alignItems:'center', gap: 4 }}>
                  <div className="inventory-summary-title" style={{ fontWeight: 600 }}>Sold price summary</div>
                  <div>{/* spacer */}</div>
                  <div>
                    <div style={{ opacity:0.7 }}>Buy total</div>
                    <div>{formatPrice(totals.buy)}</div>
                  </div>
                  <div>
                    <div style={{ opacity:0.7 }}>Sold total</div>
                    <div>{formatPrice(totals.sell)}</div>
                  </div>
                  <div>
                    <div style={{ opacity:0.7 }}>Profit</div>
                    <div className={profit >= 0 ? 'profit-text' : 'loss-text'}>{formatPrice(profit)}</div>
                  </div>
                  <div>
                    <div style={{ opacity:0.7 }}>Profit%</div>
                    <div className={profit >= 0 ? 'profit-text' : 'loss-text'}>{profitPct.toFixed(2)}%</div>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {showAddModal && (
        <AddItemModal
          onClose={() => setShowAddModal(false)}
          onAdded={async () => { await fetchAllInventoryData(); setShowAddModal(false); }}
        />
      )}

      {showAddSoldModal && (
        <div className="modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) setShowAddSoldModal(false); }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
            <div className="modal-header" style={{ position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
              <h3 style={{ margin: 0 }}>Add Sold Item</h3>
              <button
                type="button"
                onClick={() => setShowAddSoldModal(false)}
                style={{ position: 'absolute', right: 0, top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', color: 'inherit', fontSize: '1.25rem', cursor: 'pointer', padding: '0 10px' }}
              >
                ✖
              </button>
            </div>
            <div className="modal-body">
              <form onSubmit={submitAddSoldItem}>
                <div style={{ marginBottom: 15 }}>
                  <label className="form-label">Name</label>
                  <div ref={historySuggestRef} style={{ position:'relative' }}>
                    <input
                      className="form-input"
                      placeholder="Search item"
                      value={historyQuery}
                      onChange={(e) => {
                        setHistoryQuery(e.target.value);
                        setHistorySelected(null);
                      }}
                      onFocus={() => {
                        if (historySuggestions.length > 0) setHistorySuggestionsOpen(true);
                      }}
                    />
                    {historySuggestionsOpen && historySuggestions.length > 0 && (
                      <div className="search-suggestions">
                        {historySuggestions.map((s) => (
                          <button
                            key={s.slug}
                            type="button"
                            className="search-suggestion-row"
                            onClick={() => {
                              setHistorySelected(s);
                              setHistoryQuery(s.name);
                              setHistorySuggestionsOpen(false);
                            }}
                          >
                            {(() => {
                              const thumb = getImage(s.slug, s.name);
                              return thumb ? (
                                <div className="search-thumb"><img src={thumb} alt={s.name} /></div>
                              ) : (
                                <div className="category-icon" aria-hidden="true"></div>
                              );
                            })()}
                            <div className="search-text">
                              <div className="search-name">{s.name}</div>
                              <div className="search-type">{s.item_type}</div>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ marginBottom: 15 }}>
                  <label className="form-label">Amount</label>
                  <input className="form-input" value={historyAmount} onChange={(e) => setHistoryAmount(e.target.value)} placeholder="1" />
                </div>

                <div style={{ marginBottom: 15 }}>
                  <label className="form-label">Date</label>
                  <input className="form-input" type="date" value={historyDate} onChange={(e) => setHistoryDate(e.target.value)} />
                </div>

                <div style={{ marginBottom: 15 }}>
                  <label className="form-label">Buy Price</label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      className="form-input"
                      style={{ flex: 1 }}
                      value={historyBuyPrice}
                      onChange={(e) => setHistoryBuyPrice(e.target.value)}
                      placeholder="0.00"
                    />
                    <button
                      type="button"
                      className="account-button"
                      onClick={cycleHistoryCurrency}
                      style={{ width: 'auto', minWidth: '52px', padding: '0 10px', fontSize: '0.85rem' }}
                      title="Click to switch currency"
                    >
                      {historyCurrency}
                    </button>
                  </div>
                </div>

                <div style={{ marginBottom: 15 }}>
                  <label className="form-label">Sell Price</label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      className="form-input"
                      style={{ flex: 1 }}
                      value={historySellPrice}
                      onChange={(e) => setHistorySellPrice(e.target.value)}
                      placeholder="0.00"
                    />
                    <button
                      type="button"
                      className="account-button"
                      onClick={cycleHistoryCurrency}
                      style={{ width: 'auto', minWidth: '52px', padding: '0 10px', fontSize: '0.85rem' }}
                      title="Click to switch currency"
                    >
                      {historyCurrency}
                    </button>
                  </div>
                </div>

                {historyError && <div className="error-text" style={{ marginTop: 8 }}>{historyError}</div>}

                <div style={{ display: 'flex', justifyContent: 'center', marginTop: 20 }}>
                  <button type="submit" className="account-button" disabled={historySaving}>
                    {historySaving ? 'Saving…' : 'Confirm'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {sellDialogItem && (
        <div className="modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) setSellDialogItem(null); }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <div className="modal-header">
              <h3>Mark As Sold</h3>
            </div>
            <div className="modal-body">
              <form onSubmit={submitSellDialog}>
                <div style={{ marginBottom: 12, opacity: 0.8 }}>{sellDialogItem.item?.name}</div>
                <div style={{ marginBottom: 15 }}>
                  <label className="form-label">Sold Date</label>
                  <input className="form-input" type="date" value={sellDialogDate} onChange={(e) => setSellDialogDate(e.target.value)} />
                </div>
                <div style={{ marginBottom: 15 }}>
                  <label className="form-label">Buy Price (unit)</label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      className="form-input"
                      style={{ flex: 1 }}
                      value={sellDialogBuyPrice}
                      onChange={(e) => setSellDialogBuyPrice(e.target.value)}
                    />
                    <button
                      type="button"
                      className="account-button"
                      onClick={cycleSellDialogCurrency}
                      style={{ width: 'auto', minWidth: '52px', padding: '0 10px', fontSize: '0.85rem' }}
                      title="Click to switch currency"
                    >
                      {sellDialogCurrency}
                    </button>
                  </div>
                </div>
                <div style={{ marginBottom: 15 }}>
                  <label className="form-label">Sell Price (unit)</label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      className="form-input"
                      style={{ flex: 1 }}
                      value={sellDialogPrice}
                      onChange={(e) => setSellDialogPrice(e.target.value)}
                    />
                    <button
                      type="button"
                      className="account-button"
                      onClick={cycleSellDialogCurrency}
                      style={{ width: 'auto', minWidth: '52px', padding: '0 10px', fontSize: '0.85rem' }}
                      title="Click to switch currency"
                    >
                      {sellDialogCurrency}
                    </button>
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'center', gap: 10 }}>
                  <button type="button" className="account-button" style={{ background: '#444' }} onClick={() => setSellDialogItem(null)}>Cancel</button>
                  <button type="submit" className="account-button" disabled={sellingNow}>{sellingNow ? 'Saving…' : 'Move To Sold'}</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Info / Details Modal */}
      {infoItem && (
        <div className="modal-overlay" onMouseDown={(e) => { if(e.target === e.currentTarget) setInfoItem(null); }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 500 }}>
            <div className="modal-header">
              <h3>Item Details</h3>
            </div>
            {/* ... */}
            <div className="modal-body">
              <div style={{ textAlign: 'center', marginBottom: 20 }}>
                 {(() => {
                   const imgUrl = infoItem.item?.image || getImage(infoItem.slug, infoItem.item?.name);

                   return imgUrl ? (
                    <img 
                      src={imgUrl} 
                      alt={infoItem.item?.name} 
                      style={{ maxWidth: '100%', maxHeight: 150, objectFit: 'contain' }} 
                    />
                   ) : (
                    <div className="category-icon" style={{ width: 64, height: 64, margin: '0 auto' }}></div>
                   );
                 })()}
                 <h4 style={{ marginTop: 10 }}>{infoItem.item?.name}</h4>
              </div>

              <form onSubmit={handleInfoSave}>
                <div style={{ marginBottom: 15 }}>
                  <label className="form-label">Float Value</label>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <input 
                      className="form-input" 
                      type="number" 
                      step="any"
                      value={infoItem.float_value} 
                      onChange={(e) => setInfoItem({ ...infoItem, float_value: e.target.value })}
                      placeholder="e.g. 0.0345"
                      style={{ flex: 1 }}
                    />
                    <div style={{ 
                      flex: 1, 
                      padding: '8px', 
                      background: '#2a2a2a', 
                      borderRadius: 4, 
                      fontSize: '0.9rem',
                      color: '#ddd',
                      textAlign: 'center',
                      border: '1px solid #444'
                    }}>
                      {getWearName(infoItem.float_value) || 'No Wear'}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 10, marginBottom: 15 }}>
                  <div style={{ flex: 1 }}>
                     <label className="form-label">Variant</label>
                     <select 
                       className="form-input" 
                       value={infoItem.variant || ''}
                       onChange={(e) => setInfoItem({ ...infoItem, variant: e.target.value })}
                     >
                       <option value="">(Normal)</option>
                       <option value="StatTrak™">StatTrak™</option>
                       <option value="Souvenir">Souvenir</option>
                     </select>
                  </div>
                  
                  {isDoppler(infoItem.item?.name) && (
                    <div style={{ flex: 1 }}>
                      <label className="form-label">Phase</label>
                      <select 
                        className="form-input"
                        value={infoItem.phase || ''}
                        onChange={(e) => setInfoItem({ ...infoItem, phase: e.target.value })}
                      >
                        <option value="">(None)</option>
                        <option value="Phase 1">Phase 1</option>
                        <option value="Phase 2">Phase 2</option>
                        <option value="Phase 3">Phase 3</option>
                        <option value="Phase 4">Phase 4</option>
                        <option value="Ruby">Ruby</option>
                        <option value="Sapphire">Sapphire</option>
                        <option value="Black Pearl">Black Pearl</option>
                        <option value="Emerald">Emerald</option>
                      </select>
                    </div>
                  )}
                </div>

                <div style={{ marginBottom: 15 }}>
                  <label className="form-label">Description / Notes</label>
                  <textarea 
                    className="form-input" 
                    rows="3"
                    placeholder="Enter notes here (e.g. sell date, reasons)..."
                    value={infoItem.description || ''}
                    onChange={(e) => setInfoItem({ ...infoItem, description: e.target.value })}
                  ></textarea>
                </div>

                <div style={{ display: 'flex', justifyContent: 'center', gap: 10 }}>
                  <button type="button" className="account-button" style={{ background: '#444' }} onClick={() => setInfoItem(null)}>Cancel</button>
                  <button type="submit" className="account-button">Save Changes</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Portfolio Notification Modal */}
      {showPortfolioModal && (
        <div className="modal-overlay" onMouseDown={(e) => { if(e.target === e.currentTarget) setShowPortfolioModal(false); }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 500 }}>
            <div className="modal-header">
              <h3>Portfolio Updates Settings</h3>
            </div>
            <div className="modal-body">
              <p style={{ marginBottom: 15, opacity: 0.8 }}>
                Configure a Discord webhook to receive a summary of your ENTIRE portfolio whenever prices are reloaded.
                The notification will include a table of changes sorted by percentage profit/loss.
              </p>
              
              <form onSubmit={handlePortfolioWebhookSave}>
                <div style={{ marginBottom: 15 }}>
                  <label style={{ display: 'block', marginBottom: 5 }}>Discord Webhook URL</label>
                  <input 
                    className="search-input" 
                    type="text" 
                    placeholder="https://discord.com/api/webhooks/..."
                    value={portfolioWebhook}
                    onChange={(e) => setPortfolioWebhook(e.target.value)}
                    style={{ width: '100%' }}
                  />
                  <div style={{ fontSize: '0.8rem', opacity: 0.6, marginTop: 4 }}>
                    Leave empty to disable.
                  </div>
                </div>

                <div style={{ marginBottom: 15 }}>
                  <label style={{ display: 'block', marginBottom: 5 }}>Daily Update Time (UTC)</label>
                  <input 
                    className="search-input" 
                    type="time" 
                    value={portfolioNotificationTime}
                    onChange={(e) => setPortfolioNotificationTime(e.target.value)}
                    style={{ width: '100%', colorScheme: 'dark' }}
                  />
                  <small style={{ color: '#888', display: 'block', marginTop: 4 }}>
                    Current UTC time: {new Date().toISOString().slice(11, 16)}
                  </small>
                </div>

                <div style={{ display: 'flex', justifyContent: 'center', gap: 10 }}>
                   <button type="button" className="account-button" style={{ background: '#444' }} onClick={() => setShowPortfolioModal(false)}>Cancel</button>
                   <button type="submit" className="account-button">Save Settings</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Notification Modal */}
      {notificationItem && (
        <div className="modal-overlay" onMouseDown={(e) => { if(e.target === e.currentTarget) setNotificationItem(null); }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 500 }}>
            <div className="modal-header">
              <h3>Notification Settings</h3>
            </div>
            <div className="modal-body">
              <p style={{ marginBottom: 15, opacity: 0.8 }}>
                Configure Discord notifications for <strong>{notificationItem.item?.name}</strong>.
                You will key notifications when price changes.
              </p>
              
              <form onSubmit={handleNotificationSave}>
                <div style={{ marginBottom: 15 }}>
                  <label className="form-label">Discord Webhook URL</label>
                  <input 
                    className="form-input" 
                    type="text" 
                    placeholder="https://discord.com/api/webhooks/..."
                    value={notificationItem.discord_webhook_url || ''}
                    onChange={(e) => setNotificationItem({ ...notificationItem, discord_webhook_url: e.target.value })}
                  />
                  <div style={{ fontSize: '0.8rem', opacity: 0.6, marginTop: 4 }}>
                    Leave empty to disable.
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'center', gap: 10 }}>
                   <button type="button" className="account-button" style={{ background: '#444' }} onClick={() => setNotificationItem(null)}>Cancel</button>
                   <button type="submit" className="account-button">Save Settings</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default InventoryPage;
