import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useCurrency } from '../currency/CurrencyContext.jsx';
import { useAuth } from '../auth/AuthContext.jsx';
import { useNavigate } from 'react-router-dom';

const USER_ID = 1;
const BASE_URL = 'http://127.0.0.1:8000';

function InventoryPage() {
  const { userId } = useAuth();
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
  const [sellFeePct, setSellFeePct] = useState(0); // e.g., marketplace fee %
  const [withdrawFeePct, setWithdrawFeePct] = useState(0); // e.g., withdrawal fee %

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
        cancelEdit(id);
      } catch (e) {
        console.error('Save failed', e);
        alert(`Saving failed: ${e.message || e}`);
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
        <button className="account-button" onClick={() => navigate('/add')}>
          Add new item ↗
        </button>
        <button className="account-button" onClick={reloadPrices} disabled={loading}>
          {loading ? 'Loading…' : 'Reload Prices ↻'}
        </button>
      </div>

      <div className="blur-container">
        {!userId && unauthenticatedOverlay}
        <table>
        <thead>
          <tr>
            <th className="sortable" onClick={() => requestSort('amount')}>Amount <Arrow keyName="amount" /></th>
            <th className="sortable" onClick={() => requestSort('name')}>Name <Arrow keyName="name" /></th>
            <th>Float</th>
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
                  <input className="form-input" style={{ maxWidth: 160 }} value={editing[item.user_item_id].float_value}
                    onChange={(e) => setEditing((prev) => ({ ...prev, [item.user_item_id]: { ...prev[item.user_item_id], float_value: e.target.value } }))} />
                ) : (
                  (() => { const f = getFloat(item); return f === null ? '—' : f.toFixed(8); })()
                )}
              </td>
              <td>
                {formatPrice(item.buy_price)}
              </td>
              {editing[item.user_item_id] && (
                <td colSpan={2} style={{ paddingTop: 6 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <label className="form-label" style={{ margin:0 }}>Buy ({buyMode[item.user_item_id] === 'total' ? 'total' : 'unit'})</label>
                    <button className="icon-btn" title="Toggle unit/total" onClick={() => setBuyMode((prev) => ({ ...prev, [item.user_item_id]: (prev[item.user_item_id] === 'total' ? 'unit' : 'total') }))}>🔁</button>
                  </div>
                  <input className="form-input" style={{ maxWidth: 200 }} value={editing[item.user_item_id].buy_price}
                    onChange={(e) => setEditing((prev) => ({ ...prev, [item.user_item_id]: { ...prev[item.user_item_id], buy_price: e.target.value } }))} />
                  <div style={{ fontSize:'0.8rem', opacity:0.75, marginTop:4 }}>
                    {buyMode[item.user_item_id] === 'total'
                      ? `Unit preview: ${formatPrice(((Number(editing[item.user_item_id].buy_price) || 0) / (Number(editing[item.user_item_id].amount) || 1)) || 0)}`
                      : `Total preview: ${formatPrice((Number(editing[item.user_item_id].buy_price) || 0) * (Number(editing[item.user_item_id].amount) || 1))}`}
                  </div>
                </td>
              )}
              {!editing[item.user_item_id] && <td>{formatPrice(item.current_price)}</td>}
              {!editing[item.user_item_id] && <td>{formatPrice(getCurrentTotal(item))}</td>}
              <td className={item.profit >= 0 ? 'profit-text' : 'loss-text'}>
                {formatPrice(item.profit)}
              </td>
              <td className={item.profit >= 0 ? 'profit-text' : 'loss-text'}>
                {getProfitPct(item).toFixed(2)}%
              </td>
              <td>
                {editing[item.user_item_id] ? (
                  <>
                    <button className="icon-btn" title="Save" onClick={() => saveEdit(item.user_item_id)}>💾</button>
                    <button className="icon-btn" title="Cancel" onClick={() => cancelEdit(item.user_item_id)}>↩</button>
                  </>
                ) : (
                  <button className="icon-btn" title="Edit" onClick={() => startEdit(item)}>✏️</button>
                )}
                <button className="icon-btn" title="Delete" onClick={async () => {
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
                }}>❌</button>
              </td>
            </tr>
          ))}
        </tbody>
        </table>
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
                <div className="stat-card">
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
                  <div className="stat-card">
                    <div style={{ display:'grid', gridTemplateColumns:'repeat(6, 1fr)', alignItems:'center', gap: 4 }}>
                      <div style={{ fontWeight: 600 }}>After sell fee</div>
                      <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                        <span style={{ opacity:0.7 }}>Sell fee %</span>
                        <input className="form-input" style={{ maxWidth: 90 }} value={sellFeePct}
                          onChange={(e) => setSellFeePct(e.target.value)} />
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
                  <div className="stat-card">
                    <div style={{ display:'grid', gridTemplateColumns:'repeat(6, 1fr)', alignItems:'center', gap: 4 }}>
                      <div style={{ fontWeight: 600 }}>After withdraw fee</div>
                      <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                        <span style={{ opacity:0.7 }}>Withdraw fee %</span>
                        <input className="form-input" style={{ maxWidth: 90 }} value={withdrawFeePct}
                          onChange={(e) => setWithdrawFeePct(e.target.value)} />
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
    </div>
  );
}

export default InventoryPage;
