import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useCurrency } from '../currency/CurrencyContext.jsx';

const BASE_URL = 'http://127.0.0.1:8000';

function CasesPage() {
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [sortMode, setSortMode] = useState('release_new');
  const navigate = useNavigate();
  const { formatPrice } = useCurrency();

  // Load case images from src/assets/cases by slug (e.g., revolution-case.png)
  const caseImgMap = useMemo(() => {
    const files = import.meta.glob('../assets/cases/*.{png,jpg,jpeg,webp,svg}', { eager: true, query: '?url', import: 'default' });
    const map = {};
    Object.entries(files).forEach(([path, url]) => {
      const filename = path.split('/').pop() || '';
      const base = filename.substring(0, filename.lastIndexOf('.'));
      map[base.toLowerCase()] = url;
    });
    return map;
  }, []);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await axios.get(`${BASE_URL}/cases`);
        const arr = Array.isArray(res.data) ? res.data : [];
        setCases(arr);
      } catch (e) {
        console.error(e);
        setError('Failed to load cases');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const doRefreshPrices = async () => {
    try {
      setRefreshing(true);
      await axios.post(`${BASE_URL}/refresh-items`, null, { params: { item_type: 'case' } });
      // After server refresh, re-fetch list
      const res = await axios.get(`${BASE_URL}/cases`);
      const arr = Array.isArray(res.data) ? res.data : [];
      setCases(arr);
    } catch (e) {
      console.error(e);
    } finally {
      setRefreshing(false);
    }
  };

  const sortedCases = useMemo(() => {
    const arr = [...cases];
    const getPrice = (c) => c.current_price ? parseFloat(c.current_price) : 0;
    const getDate = (c) => c.release_date ? new Date(c.release_date) : new Date(0);
    switch (sortMode) {
      case 'price_asc':
        arr.sort((a,b) => getPrice(a) - getPrice(b));
        break;
      case 'price_desc':
        arr.sort((a,b) => getPrice(b) - getPrice(a));
        break;
      case 'release_new':
        arr.sort((a,b) => getDate(b) - getDate(a));
        break;
      case 'release_old':
        arr.sort((a,b) => getDate(a) - getDate(b));
        break;
      default:
        break;
    }
    return arr;
  }, [cases, sortMode]);

  const badgeColors = (dt) => {
    switch ((dt || '').toLowerCase()) {
      case 'active':
        return { bg:'rgba(34,197,94,0.18)', color:'var(--profit-color)' };
      case 'rare':
        return { bg:'rgba(234,179,8,0.25)', color:'#fbbf24' };
      case 'discontinued':
        return { bg:'rgba(239,68,68,0.18)', color:'var(--loss-color)' };
      default:
        return { bg:'rgba(107,114,128,0.25)', color:'var(--text-color)' };
    }
  };

  if (loading) {
    return <div className="dashboard-container"><div className="loading">Loading cases…</div></div>;
  }
  if (error) {
    return <div className="dashboard-container"><div className="loading">{error}</div></div>;
  }

  return (
    <div className="dashboard-container">
      <div style={{ display:'flex', gap:12, flexWrap:'wrap', alignItems:'center', marginBottom:12 }}>
        <button onClick={() => navigate(-1)} aria-label="Back" style={{
          background:'var(--button-bg)', color:'var(--button-text)', border:'1px solid var(--border-color)', borderRadius:10, padding:'6px 10px', cursor:'pointer'
        }}>←</button>
        <h2 style={{ margin:0, flex:1, paddingLeft:'14%' }}>Cases</h2>
        <select value={sortMode} onChange={(e)=>setSortMode(e.target.value)} style={{
          background:'var(--surface-bg)', color:'var(--text-color)', border:'1px solid var(--border-color)', borderRadius:8, padding:'6px 8px'
        }}>
            
          <option value="price_desc">Price ↓</option>
          <option value="price_asc">Price ↑</option>
          <option value="release_new">Newest</option>
          <option value="release_old">Oldest</option>
        </select>
        <button
          onClick={doRefreshPrices}
          disabled={refreshing}
          style={{
            background:'var(--button-bg)',
            color:'var(--button-text)',
            border:'1px solid var(--border-color)',
            padding:'8px 12px',
            borderRadius:10,
            cursor: refreshing ? 'not-allowed':'pointer'
          }}
        >{refreshing ? 'Refreshing…' : 'Refresh prices'}</button>
      </div>
      <div className="categories-grid">
        {sortedCases.map(cs => (
          <div
            key={cs.item_id}
            className="category-card"
            onClick={() => navigate(`/case/${cs.slug}`)}
            style={{ cursor: 'pointer' }}
          >
            {caseImgMap[cs.slug] ? (
              <img src={caseImgMap[cs.slug]} alt={cs.name} className="category-img" />
            ) : (
              <div className="category-icon" aria-hidden="true"></div>
            )}
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
              <span className="category-label" style={{ fontSize:'0.95rem' }}>{cs.name}</span>
              {(() => { const c = badgeColors(cs.drop_type); return (
                <span style={{
                  fontSize:'0.65rem',
                  padding:'3px 6px',
                  borderRadius:6,
                  background: c.bg,
                  color: c.color,
                  fontWeight:600
                }}>{(cs.drop_type || 'unknown').toUpperCase()}</span>
              )})()}
            </div>
            <div style={{ fontSize:'0.75rem', opacity:0.65, marginBottom:6 }}>Released: {cs.release_date || '—'}</div>
            <div style={{ fontSize:'0.85rem', fontWeight:600 }}>{formatPrice(cs.current_price)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default CasesPage;