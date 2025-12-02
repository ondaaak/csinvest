import React, { useEffect, useState } from 'react';
import AddItemModal from '../components/AddItemModal.jsx';
import axios from 'axios';
import { useCurrency } from '../currency/CurrencyContext.jsx';
import { useAuth } from '../auth/AuthContext.jsx';
import { useNavigate } from 'react-router-dom';

const USER_ID = 1;
const BASE_URL = 'http://127.0.0.1:8000';

function InventoryPage() {
  const { userId, logout } = useAuth();
  const { formatPrice } = useCurrency();
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState(''); // 'amount' | 'name' | 'buy' | 'current' | 'profit' | 'profitPct'
  const [sortAsc, setSortAsc] = useState(true);
  const [editing, setEditing] = useState({}); // { [user_item_id]: { amount, float_value, pattern, buy_price } }
  const [buyMode, setBuyMode] = useState({}); // { [user_item_id]: 'unit' | 'total' }
  const [savingIds, setSavingIds] = useState(new Set()); // track rows being saved to prevent repeated clicks
  const [sellFeePct, setSellFeePct] = useState(2); // default marketplace fee %
  const [withdrawFeePct, setWithdrawFeePct] = useState(2); // default withdrawal fee %
  // Raw string values so user can freely type (can be blank or partial)
  const [rawSellFee, setRawSellFee] = useState('2');
  const [rawWithdrawFee, setRawWithdrawFee] = useState('2');
  const round2 = (v) => Math.round((Number(v) || 0) * 100) / 100;
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

  const fetchItems = async () => {
    setLoading(true);
    setError(null);
    try {
      if (!userId) {
        // Bez přihlášení jen vyprázdníme a skončíme tiše
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

        {/* summary cards are rendered below in the return JSX */}

    const saveEdit = async (id) => {
      const token = localStorage.getItem('csinvest:token');
      const payload = editing[id];
      if (!payload) return;
      if (savingIds.has(id)) return;
      setSavingIds(prev => new Set([...prev, id]));
      // Close editor immediately for single-click behavior
      cancelEdit(id);
      const amt = Number(payload.amount) || 1;
      let buyUnit = Number(payload.buy_price);
      if (!Number.isFinite(buyUnit)) buyUnit = 0;
      if (buyMode[id] === 'total') {
        buyUnit = amt > 0 ? (buyUnit / amt) : buyUnit;
      }
      try {
        const resp = await fetch(`${BASE_URL}/useritems/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            amount: amt,
            float_value: payload.float_value === '' ? null : Number(payload.float_value),
            pattern: payload.pattern === '' ? null : Number(payload.pattern),
            buy_price: buyUnit,
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
        // Also refresh portfolio prices/totals so Overview reflects changes immediately
        try {
          if (userId) {
            await axios.post(`${BASE_URL}/refresh-portfolio/${userId}`);
          }
        } catch (e) {
          console.warn('Portfolio refresh after save failed (continuing):', e);
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
    setEditing((prev) => ({
      ...prev,
      [id]: {
        amount: getAmount(item),
        float_value: item.float_value ?? '',
        pattern: item.pattern ?? '',
        buy_price: item.buy_price ?? 0,
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

  // Inline SVG icons for actions (accessible, themable via currentColor)
  const PencilIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 20h9" />
      <path d="M16.5 3.5l4 4-11 11H5v-4z" />
    </svg>
  );
  const SaveIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 5h11l4 4v10a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z" />
      <path d="M12 9v6" />
      <path d="M9 9h6" />
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
              <td>
                {item.item ? (
                  <button className="link-btn" onClick={() => openItem(item.item)}>{item.item.name}</button>
                ) : '—'}
              </td>
              <td>
                {editing[item.user_item_id] ? (
                  <div>
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <label className="form-label" style={{ margin:0 }}>Buy ({buyMode[item.user_item_id] === 'total' ? 'total' : 'unit'})</label>
                      <button className="icon-btn toggle-btn" title="Toggle unit/total" aria-label="Toggle unit or total"
                        onClick={() => setBuyMode((prev) => ({ ...prev, [item.user_item_id]: (prev[item.user_item_id] === 'total' ? 'unit' : 'total') }))}>
                        <ToggleIcon />
                      </button>
                    </div>
                    <input className="form-input compact" style={{ maxWidth: 120 }} value={editing[item.user_item_id].buy_price}
                      onChange={(e) => setEditing((prev) => ({ ...prev, [item.user_item_id]: { ...prev[item.user_item_id], buy_price: e.target.value } }))} />
                    <div style={{ fontSize:'0.8rem', opacity:0.75, marginTop:4 }}>
                      {buyMode[item.user_item_id] === 'total'
                        ? `Unit preview: ${formatPrice(((Number(editing[item.user_item_id].buy_price) || 0) / (Number(editing[item.user_item_id].amount) || 1)) || 0)}`
                        : `Total preview: ${formatPrice((Number(editing[item.user_item_id].buy_price) || 0) * (Number(editing[item.user_item_id].amount) || 1))}`}
                    </div>
                  </div>
                ) : (
                  <>
                    {savingIds.has(item.user_item_id) && <span className="spinner" title="Saving" aria-label="Saving" style={{ marginRight: 6 }} />}
                    {formatPrice(item.buy_price)}
                  </>
                )}
              </td>
              <td title={`last update: ${(() => { const d = item?.item?.last_update || item?.last_update; try { return d ? new Date(d).toLocaleString() : '—'; } catch { return '—'; } })()}`}>{formatPrice(item.current_price)}</td>
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
                  <button className="icon-btn" title="Edit" onClick={() => startEdit(item)} disabled={savingIds.has(item.user_item_id)}><PencilIcon /></button>
                )}
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
    </div>
  );
}

export default InventoryPage;
