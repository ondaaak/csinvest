import React, { useEffect, useState, useMemo } from 'react';
import AddItemModal from '../components/AddItemModal.jsx';
import axios from 'axios';
import { useCurrency } from '../currency/CurrencyContext.jsx';
import { useAuth } from '../auth/AuthContext.jsx';
import { useNavigate } from 'react-router-dom';

const USER_ID = 1;
const BASE_URL = 'http://127.0.0.1:8000';

const isDoppler = (nm) => nm && nm.includes('Doppler');

function InventoryPage() {
  const { userId, logout } = useAuth();
  const { formatPrice, currency, rates } = useCurrency();
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState('total'); 
  const [sortAsc, setSortAsc] = useState(false);
  const [editing, setEditing] = useState({}); 
  const [buyMode, setBuyMode] = useState({}); 
  const [savingIds, setSavingIds] = useState(new Set()); 
  const [updatingIds, setUpdatingIds] = useState(new Set());

  const [sellFeePct, setSellFeePct] = useState(2); 
  const [withdrawFeePct, setWithdrawFeePct] = useState(2); 

  const [rawSellFee, setRawSellFee] = useState('2');
  const [rawWithdrawFee, setRawWithdrawFee] = useState('2');
  const round2 = (v) => Math.round((Number(v) || 0) * 100) / 100;

  // Import images
  const skinsGlob = import.meta.glob('../assets/skins/*.{png,jpg,jpeg,svg,webp}', { eager: true, query: '?url', import: 'default' });
  const glovesGlob = import.meta.glob('../assets/gloves/*.{png,jpg,jpeg,svg,webp}', { eager: true, query: '?url', import: 'default' });
  const casesGlob = import.meta.glob('../assets/cases/*.{png,jpg,jpeg,svg,webp}', { eager: true, query: '?url', import: 'default' });
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
    return round2(num);
  };
  const normalizeOnBlur = (rawValue, setRaw, setNumeric) => {
    if (rawValue === '') { setNumeric(0); return; }
    const n = parseFee(rawValue);
    setNumeric(n);
    setRaw(n.toFixed(2));
  };
  const [showAddModal, setShowAddModal] = useState(false);
  const [infoItem, setInfoItem] = useState(null); // State for the item details modal
  const [notificationItem, setNotificationItem] = useState(null); // State for notification modal

  const fetchItems = async () => {
    setLoading(true);
    setError(null);
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
      setError('Nepodařilo se načíst položky.');
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
      setError('Aktualizace cen selhala.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, []);

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
            alert('Session expired. Please login again.');
            logout();
            navigate('/login');
            return;
          }
          alert(`Saving failed: ${text}`);
          return;
        }

        await fetchItems();
      } catch (e) {
        console.error('Save failed', e);
        alert(`Saving failed: ${e.message || e}`);
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

  const getFloat = (it) => {
    const v = it.float_value ?? it.item?.wearValue ?? null;
    return v === null || v === undefined ? null : Number(v);
  };

  const getBuyTotal = (it) => (it.buy_price || 0) * getAmount(it);
  const getCurrentTotal = (it) => (it.current_price || 0) * getAmount(it);

  const openItem = (itm) => {
    if (!itm) return;
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

  const Arrow = ({ keyName }) => (
    <span className="sort-arrow">{sortKey === keyName ? (sortAsc ? '↑' : '↓') : ''}</span>
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
    
    // Construct payload for update
    // We only update float for now, description is placeholder
    const id = infoItem.user_item_id;
    const token = localStorage.getItem('csinvest:token');
    
    try {
      const resp = await fetch(`${BASE_URL}/useritems/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
           float_value: infoItem.float_value === '' ? null : Number(infoItem.float_value),
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
      alert(err.message);
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
      alert(err.message);
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
        {}, // empty body
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      await fetchItems();
    } catch (e) {
      console.error(e);
      alert('Price refresh failed');
    } finally {
      setUpdatingIds(prev => {
        const next = new Set(prev);
        next.delete(uid);
        return next;
      });
    }
  };

  const unauthenticatedOverlay = (
    <div className="blur-overlay">
      <div className="blur-message">Please login to view your inventory.</div>
    </div>
  );

  return (
    <div className="dashboard-container">
      <h2 style={{ textAlign: 'center' }}>Items</h2>

      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <input
          className="search-input"
          placeholder="Search..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="inventory-actions">
        <button className="account-button" onClick={() => setShowAddModal(true)}>
          Add new item +
        </button>
        <button className="account-button" onClick={reloadPrices} disabled={loading}>
          {loading ? 'Loading…' : 'Reload Prices ↻'}
        </button>
      </div>

      <div className="blur-container">
        {userId ? (
          items.length > 0 ? (
        <table>
        <thead>
          <tr>
            <th className="sortable" onClick={() => requestSort('amount')}>Amount <Arrow keyName="amount" /></th>
            <th style={{ width: 50 }}></th>
            <th className="sortable" onClick={() => requestSort('name')}>Name <Arrow keyName="name" /></th>
            <th className="sortable" onClick={() => requestSort('buyUnit')}>Buy (unit) <Arrow keyName="buyUnit" /></th>
            <th className="sortable" onClick={() => requestSort('sellUnit')}>Sell (unit) <Arrow keyName="sellUnit" /></th>
            <th className="sortable" onClick={() => requestSort('total')}>Total (all) <Arrow keyName="total" /></th>
            <th className="sortable" onClick={() => requestSort('profit')}>Profit <Arrow keyName="profit" /></th>
            <th className="sortable" onClick={() => requestSort('profitPct')}>Profit% <Arrow keyName="profitPct" /></th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((item) => (
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
                        ? `Unit: ${formatPrice(((Number(editing[item.user_item_id].buy_price) || 0) / (Number(editing[item.user_item_id].amount) || 1)) || 0)}`
                        : `Total: ${formatPrice((Number(editing[item.user_item_id].buy_price) || 0) * (Number(editing[item.user_item_id].amount) || 1))}`}
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
                      if (!window.confirm('Delete this item?')) return;
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
        </tbody>
        </table>
          ) : (
            !loading ? <div className="loading">Portfolio is empty.</div> : null
          )
        ) : (
          unauthenticatedOverlay
        )}
      </div>

      {/* Portfolio summary */}
      {items.length > 0 && (
        <div style={{ marginTop: 24 }}>
          {(() => {
            const totals = items.reduce((acc, it) => {
              const amt = getAmount(it);
              const buyT = (it.buy_price || 0) * amt;
              const sellT = (it.current_price || 0) * amt;
              acc.buy += buyT;
              acc.sell += sellT;
              return acc;
            }, { buy: 0, sell: 0 });
            const profit = totals.sell - totals.buy;
            const profitPct = totals.buy > 0 ? (profit / totals.buy) * 100 : 0;

            const sellFeeRate = Math.max(0, Number(sellFeePct) || 0) / 100;
            const sellAfterFee = totals.sell * (1 - sellFeeRate);
            const profitAfterSellFee = sellAfterFee - totals.buy;
            const profitAfterSellFeePct = totals.buy > 0 ? (profitAfterSellFee / totals.buy) * 100 : 0;

            const withdrawFeeRate = Math.max(0, Number(withdrawFeePct) || 0) / 100;
            const withdrawAfterFee = sellAfterFee * (1 - withdrawFeeRate);
            const profitAfterWithdrawFee = withdrawAfterFee - totals.buy;
            const profitAfterWithdrawFeePct = totals.buy > 0 ? (profitAfterWithdrawFee / totals.buy) * 100 : 0;

            const round2 = (v) => Math.round((Number(v) || 0) * 100) / 100;

            return (
              <div>
                <div className="stat-card summary-card">
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(6, 1fr)', alignItems:'center', gap: 4 }}>
                    <div style={{ fontWeight: 600 }}>Market price</div>
                    <div>{/* spacer to align with fee input in other rows */}</div>
                    <div>
                      <div style={{ opacity:0.7 }}>Deposit</div>
                      <div>{formatPrice(totals.buy)}</div>
                    </div>
                    <div>
                      <div style={{ opacity:0.7 }}>Sell price</div>
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
                  <div className="stat-card summary-card">
                    <div style={{ display:'grid', gridTemplateColumns:'repeat(6, 1fr)', alignItems:'center', gap: 4 }}>
                      <div style={{ fontWeight: 600 }}>After sell fee</div>
                      <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                        <span style={{ opacity:0.7 }}>Sell fee %</span>
                        <input
                          className="form-input no-spin"
                          type="text"
                          inputMode="decimal"
                          style={{ maxWidth: 90 }}
                          placeholder="0"
                          value={rawSellFee}
                          onChange={(e) => { setRawSellFee(e.target.value); setSellFeePct(parseFee(e.target.value)); }}
                          onBlur={() => normalizeOnBlur(rawSellFee, setRawSellFee, setSellFeePct)}
                        />
                        <div className="number-arrows">
                          <button type="button" onClick={() => { setSellFeePct(p => {
                            const v = round2(Math.min(100, (Number(p)||0) + 0.1));
                            setRawSellFee(v.toFixed(2));
                            return v; }); }}>▲</button>
                          <button type="button" onClick={() => { setSellFeePct(p => {
                            const v = round2(Math.max(0, (Number(p)||0) - 0.1));
                            setRawSellFee(v.toFixed(2));
                            return v; }); }}>▼</button>
                        </div>
                      </div>
                      <div>
                        <div style={{ opacity:0.7 }}>Deposit</div>
                        <div>{formatPrice(totals.buy)}</div>
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
                    <div style={{ display:'grid', gridTemplateColumns:'repeat(6, 1fr)', alignItems:'center', gap: 4 }}>
                      <div style={{ fontWeight: 600 }}>After withdraw fee</div>
                      <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                        <span style={{ opacity:0.7 }}>Withdraw fee %</span>
                        <input
                          className="form-input no-spin"
                          type="text"
                          inputMode="decimal"
                          style={{ maxWidth: 90 }}
                          placeholder="0"
                          value={rawWithdrawFee}
                          onChange={(e) => { setRawWithdrawFee(e.target.value); setWithdrawFeePct(parseFee(e.target.value)); }}
                          onBlur={() => normalizeOnBlur(rawWithdrawFee, setRawWithdrawFee, setWithdrawFeePct)}
                        />
                        <div className="number-arrows">
                          <button type="button" onClick={() => { setWithdrawFeePct(p => {
                            const v = round2(Math.min(100, (Number(p)||0) + 0.1));
                            setRawWithdrawFee(v.toFixed(2));
                            return v; }); }}>▲</button>
                          <button type="button" onClick={() => { setWithdrawFeePct(p => {
                            const v = round2(Math.max(0, (Number(p)||0) - 0.1));
                            setRawWithdrawFee(v.toFixed(2));
                            return v; }); }}>▼</button>
                        </div>
                      </div>
                      <div>
                        <div style={{ opacity:0.7 }}>Deposit</div>
                        <div>{formatPrice(totals.buy)}</div>
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
      {showAddModal && (
        <AddItemModal
          onClose={() => setShowAddModal(false)}
          onAdded={async () => { await fetchItems(); setShowAddModal(false); }}
        />
      )}

      {/* Info / Details Modal */}
      {infoItem && (
        <div className="modal-overlay" onClick={() => setInfoItem(null)}>
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

      {/* Notification Modal */}
      {notificationItem && (
        <div className="modal-overlay" onClick={() => setNotificationItem(null)}>
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
                    Create a webhook in your Discord server settings (Integrations - Webhooks) and paste the URL here.
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'center', gap: 10 }}>
                   <button type="button" className="account-button" style={{ background: '#444' }} onClick={() => setNotificationItem(null)}>Cancel</button>
                   {notificationItem.discord_webhook_url && (
                     <button 
                       type="button" 
                       className="account-button" 
                       style={{ background: '#d32f2f' }} 
                       onClick={async () => {
                         if(!window.confirm('Stop getting notifications for this item?')) return;
                         
                         try {
                           const token = localStorage.getItem('csinvest:token');
                           const resp = await fetch(`${BASE_URL}/useritems/${notificationItem.user_item_id}`, {
                             method: 'PATCH',
                             headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                             body: JSON.stringify({ discord_webhook_url: null })
                           });
                           if (!resp.ok) throw new Error('Failed to remove webhook');

                           await fetchItems();
                           setNotificationItem(null);
                         } catch(e) { alert(e.message); }
                       }}
                     >
                       Remove Webhook
                     </button>
                   )}
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
