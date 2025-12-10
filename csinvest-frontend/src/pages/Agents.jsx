import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useCurrency } from '../currency/CurrencyContext.jsx';

const API_BASE = 'http://127.0.0.1:8000';

export default function AgentsPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [sortMode, setSortMode] = useState('release_new');
  const [query, setQuery] = useState('');
  const navigate = useNavigate();
  const location = useLocation();
  const { formatPrice } = useCurrency();

  const q = new URLSearchParams(location.search).get('q') || '';

  const agentImgMap = useMemo(() => {
    const files = import.meta.glob('../assets/skins/*.{png,jpg,jpeg,webp,svg}', { eager: true, query: '?url', import: 'default' });
    const map = {};
    Object.entries(files).forEach(([path, url]) => {
      const filename = path.split('/').pop() || '';
      const base = filename.substring(0, filename.lastIndexOf('.'));
      map[base.toLowerCase()] = url;
    });
    return map;
  }, []);

  const sortedKeys = useMemo(() => {
    return Object.keys(agentImgMap).sort((a, b) => b.length - a.length);
  }, [agentImgMap]);

  const getAgentImage = (slug) => {
    if (!slug) return null;
    const s = slug.toLowerCase();
    if (agentImgMap[s]) return agentImgMap[s];
    const match = sortedKeys.find(key => s.startsWith(key));
    return match ? agentImgMap[match] : null;
  };

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const url = q ? `${API_BASE}/search/items?q=${encodeURIComponent(q)}&item_type=agent` : `${API_BASE}/items?item_type=agent`;
        const res = await fetch(url);
        if (!res.ok) throw new Error('Failed to load agents');
        const data = await res.json();
        const arr = Array.isArray(data) ? data : [];
        setItems(arr);
        setQuery(q);
      } catch (e) {
        setError(e.message || 'Error');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [q]);

  const doRefreshPrices = async () => {
    try {
      setRefreshing(true);
      await fetch(`${API_BASE}/refresh-items?item_type=agent`, { method: 'POST' });
      const url = query ? `${API_BASE}/search/items?q=${encodeURIComponent(query)}&item_type=agent` : `${API_BASE}/items?item_type=agent`;
      const res = await fetch(url);
      const data = await res.json();
      setItems(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
    } finally {
      setRefreshing(false);
    }
  };

  const sortedItems = React.useMemo(() => {
    const arr = [...items];
    const getPrice = (c) => typeof c.current_price === 'number' ? c.current_price : 0;
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
    const ql = (query || '').toLowerCase();
    return ql ? arr.filter(c => (c.name || '').toLowerCase().includes(ql) || (c.slug || '').toLowerCase().includes(ql)) : arr;
  }, [items, sortMode, query]);

  const getRarityColor = (rarity) => {
    if (!rarity) return { bg: 'rgba(107,114,128,0.25)', color: 'var(--text-color)' };
    const r = rarity.toLowerCase();
    if (r.includes('contraband')) return { bg: 'rgba(228, 174, 57, 0.25)', color: '#e4ae39' };
    if (r.includes('covert') || r.includes('extraordinary')) return { bg: 'rgba(235, 75, 75, 0.25)', color: '#eb4b4b' };
    if (r.includes('classified')) return { bg: 'rgba(211, 44, 230, 0.25)', color: '#d32ce6' };
    if (r.includes('restricted')) return { bg: 'rgba(136, 71, 255, 0.25)', color: '#8847ff' };
    if (r.includes('mil-spec')) return { bg: 'rgba(75, 105, 255, 0.25)', color: '#4b69ff' };
    if (r.includes('industrial')) return { bg: 'rgba(94, 152, 217, 0.25)', color: '#5e98d9' };
    if (r.includes('consumer')) return { bg: 'rgba(176, 195, 217, 0.25)', color: '#b0c3d9' };
    return { bg: 'rgba(107,114,128,0.25)', color: 'var(--text-color)' };
  };

  return (
    <div className="dashboard-container">
      <div style={{ display:'flex', gap:12, alignItems:'center', marginBottom:12 }}>
        <button onClick={() => navigate(-1)} aria-label="Back" style={{
          background:'var(--button-bg)', color:'var(--button-text)', border:'1px solid var(--border-color)', borderRadius:10, padding:'6px 10px', cursor:'pointer'
        }}>←</button>
        <h2 style={{ margin:0, flex:1, paddingLeft:'14%' }}>Agents</h2>
        <div style={{ position: 'relative', width: 320, maxWidth: '100%' }}>
          <input
            className="search-input"
            type="text"
            placeholder="Search agents..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{ width: '100%', paddingRight: 30 }}
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              style={{
                position: 'absolute',
                right: 8,
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'transparent',
                border: 'none',
                color: 'var(--text-color)',
                fontSize: '1.2rem',
                cursor: 'pointer',
                padding: 0,
                lineHeight: 1,
              }}
              aria-label="Clear search"
            >
              ×
            </button>
          )}
        </div>
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
      {loading && <div className="loading">Loading agents…</div>}
      {error && <div className="loading" style={{ color:'tomato' }}>{error}</div>}
      <div className="categories-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        {sortedItems.map(it => (
          <div
            key={it.slug}
            className="category-card item-card"
            onClick={() => navigate(`/skin/${it.slug}`)}
            style={{ cursor: 'pointer' }}
          >
            {getAgentImage(it.slug) ? (
              <img src={getAgentImage(it.slug)} alt={it.name} className="category-img" />
            ) : (
              <div className="category-icon" aria-hidden="true"></div>
            )}
            <div style={{ marginBottom:8 }}>
              <div className="category-label" style={{ fontSize:'0.95rem' }}>{it.name}</div>
              {it.rarity && (
                <span style={{
                  display:'inline-block',
                  marginTop:6,
                  fontSize:'0.65rem',
                  padding:'3px 6px',
                  borderRadius:6,
                  background: getRarityColor(it.rarity).bg,
                  color: getRarityColor(it.rarity).color,
                  fontWeight:600
                }}>
                  {it.rarity.toUpperCase()}
                </span>
              )}
            </div>
            <div style={{ fontSize:'0.85rem', fontWeight:600 }}>{typeof it.current_price === 'number' ? formatPrice(it.current_price) : '—'}</div>
          </div>
        ))}
        {(!loading && items.length === 0) && (
          <div style={{ textAlign: 'center', width: '100%', color: '#6b7280' }}>No agents found.</div>
        )}
      </div>
    </div>
  );
}
