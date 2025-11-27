import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useCurrency } from '../currency/CurrencyContext.jsx';
import { useAuth } from '../auth/AuthContext.jsx';

const USER_ID = 1;
const BASE_URL = 'http://127.0.0.1:8000';

function InventoryPage() {
  const { userId } = useAuth();
  const { formatPrice } = useCurrency();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState(''); // 'amount' | 'name' | 'buy' | 'current' | 'profit' | 'profitPct'
  const [sortAsc, setSortAsc] = useState(true);

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
      const data = arr.map((item) => ({
        ...item,
        profit: item.current_price - item.buy_price,
      }));
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

  const filtered = items.filter((it) =>
    (it.item?.name || '').toLowerCase().includes(search.toLowerCase())
  );

  const getAmount = (it) => (typeof it.amount === 'number' ? it.amount : 1);
  const getProfitPct = (it) => {
    const denom = it.buy_price || 0.000001;
    return (it.profit / denom) * 100;
  };

  const sorted = [...filtered].sort((a, b) => {
    const dir = sortAsc ? 1 : -1;
    switch (sortKey) {
      case 'amount':
        return (getAmount(a) - getAmount(b)) * dir;
      case 'name':
        return (a.item?.name || '').localeCompare(b.item?.name || '') * dir;
      case 'buy':
        return (a.buy_price - b.buy_price) * dir;
      case 'current':
        return (a.current_price - b.current_price) * dir;
      case 'profit':
        return (a.profit - b.profit) * dir;
      case 'profitPct':
        return (getProfitPct(a) - getProfitPct(b)) * dir;
      default:
        return 0;
    }
  });

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
        <button className="account-button" onClick={() => console.log('add new item')}>
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
            <th className="sortable" onClick={() => requestSort('buy')}>BuyPrice <Arrow keyName="buy" /></th>
            <th className="sortable" onClick={() => requestSort('current')}>CurrentPrice <Arrow keyName="current" /></th>
            <th className="sortable" onClick={() => requestSort('profit')}>Profit <Arrow keyName="profit" /></th>
            <th className="sortable" onClick={() => requestSort('profitPct')}>Profit% <Arrow keyName="profitPct" /></th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((item) => (
            <tr key={item.user_item_id}>
              <td>{getAmount(item)}</td>
              <td>{item.item?.name}</td>
              <td>{formatPrice(item.buy_price)}</td>
              <td>{formatPrice(item.current_price)}</td>
              <td className={item.profit >= 0 ? 'profit-text' : 'loss-text'}>
                {formatPrice(item.profit)}
              </td>
              <td className={item.profit >= 0 ? 'profit-text' : 'loss-text'}>
                {getProfitPct(item).toFixed(2)}%
              </td>
              <td>
                <button className="icon-btn" title="Edit" onClick={() => console.log('edit', item.user_item_id)}>✏️</button>
                <button className="icon-btn" title="Delete" onClick={() => console.log('delete', item.user_item_id)}>❌</button>
              </td>
            </tr>
          ))}
        </tbody>
        </table>
      </div>
    </div>
  );
}

export default InventoryPage;
