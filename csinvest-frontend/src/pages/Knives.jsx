import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useCurrency } from '../currency/CurrencyContext.jsx';

const API_BASE = 'http://127.0.0.1:8000';

export default function KnivesPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [sortMode, setSortMode] = useState('release_new');
  const [query, setQuery] = useState('');
  const navigate = useNavigate();
  const location = useLocation();
  const { formatPrice } = useCurrency();

  const KNIFE_TYPES = React.useMemo(() => [
    { name: 'Karambit', imgSlug: 'karambit-vanilla' },
    { name: 'Butterfly Knife', imgSlug: 'butterfly-knife-vanilla' },
    { name: 'M9 Bayonet', imgSlug: 'm9-bayonet-vanilla' },
    { name: 'Bayonet', imgSlug: 'bayonet-vanilla' },
    { name: 'Talon Knife', imgSlug: 'talon-knife-vanilla' },
    { name: 'Skeleton Knife', imgSlug: 'skeleton-knife-vanilla' },
    { name: 'Nomad Knife', imgSlug: 'nomad-knife-vanilla' },
    { name: 'Survival Knife', imgSlug: 'survival-knife-vanilla' },
    { name: 'Paracord Knife', imgSlug: 'paracord-knife-vanilla' },
    { name: 'Classic Knife', imgSlug: 'classic-knife-vanilla' },
    { name: 'Stiletto Knife', imgSlug: 'stiletto-knife-vanilla' },
    { name: 'Ursus Knife', imgSlug: 'ursus-knife-vanilla' },
    { name: 'Navaja Knife', imgSlug: 'navaja-knife-vanilla' },
    { name: 'Huntsman Knife', imgSlug: 'huntsman-knife-vanilla' },
    { name: 'Falchion Knife', imgSlug: 'falchion-knife-vanilla' },
    { name: 'Bowie Knife', imgSlug: 'bowie-knife-vanilla' },
    { name: 'Shadow Daggers', imgSlug: 'shadow-daggers-vanilla' },
    { name: 'Flip Knife', imgSlug: 'flip-knife-vanilla' },
    { name: 'Gut Knife', imgSlug: 'gut-knife-vanilla' },
    { name: 'Kukri Knife', imgSlug: 'kukri-knife-vanilla' },
  ], []);

  const q = new URLSearchParams(location.search).get('q') || '';

  const skinImgMap = useMemo(() => {
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
    return Object.keys(skinImgMap).sort((a, b) => b.length - a.length);
  }, [skinImgMap]);

  const getSkinImage = (slug) => {
    if (!slug) return null;
    const s = slug.toLowerCase();
    if (skinImgMap[s]) return skinImgMap[s];
    // Try prefix match with longest keys first
    const match = sortedKeys.find(key => s.startsWith(key));
    return match ? skinImgMap[match] : null;
  };

  useEffect(() => {
    const fetchData = async () => {
      // If no query parameter, we do not fetch all items. Instead we show categories.
      if (!q) {
        setItems([]);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const url = `${API_BASE}/search/knives?q=${encodeURIComponent(q)}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error('Failed to load knives');
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
      await fetch(`${API_BASE}/refresh-items?item_type=knife`, { method: 'POST' });
      const url = query ? `${API_BASE}/search/knives?q=${encodeURIComponent(query)}` : `${API_BASE}/search/knives`;
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

  return (
    <div className="dashboard-container">
      <div style={{ display:'flex', gap:12, alignItems:'center', marginBottom:12 }}>
        <button onClick={() => navigate(-1)} aria-label="Back" style={{
          background:'var(--button-bg)', color:'var(--button-text)', border:'1px solid var(--border-color)', borderRadius:10, padding:'6px 10px', cursor:'pointer'
        }}>←</button>
        <h2 style={{ margin:0, flex:1, paddingLeft:'14%' }}>Knives</h2>
        <div style={{ position: 'relative', width: 320, maxWidth: '100%' }}>
          <input
            className="search-input"
            type="text"
            placeholder="Search knives..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                navigate(`?q=${encodeURIComponent(query)}`);
              }
            }}
            style={{ width: '100%', paddingRight: 30 }}
          />
          {query && (
            <button
              onClick={() => {
                setQuery('');
                navigate('.');
              }}
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
      {loading && <div className="loading">Loading knives…</div>}
      {error && <div className="loading" style={{ color:'tomato' }}>{error}</div>}
      {!q ? (
        <div className="categories-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
          {KNIFE_TYPES.map(cat => (
            <div
              key={cat.name}
              className="category-card item-card"
              onClick={() => {
                setQuery(cat.name + ' | ');
                navigate(`?q=${encodeURIComponent(cat.name + ' | ')}`);
              }}
              style={{ cursor: 'pointer' }}
            >
              {getSkinImage(cat.imgSlug) ? (
                <img src={getSkinImage(cat.imgSlug)} alt={cat.name} className="category-img" />
              ) : (
                <div className="category-icon" aria-hidden="true"></div>
              )}
              <div style={{ marginBottom:8, textAlign:'center', fontWeight:'bold' }}>
                <div className="category-label" style={{ fontSize:'1.1rem' }}>{cat.name}</div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="categories-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
          {sortedItems.map(it => (
            <div
              key={it.slug}
              className="category-card item-card"
              onClick={() => navigate(`/skin/${it.slug}`)}
              style={{ cursor: 'pointer' }}
            >
              {getSkinImage(it.slug) ? (
                <img src={getSkinImage(it.slug)} alt={it.name} className="category-img" />
              ) : (
                <div className="category-icon" aria-hidden="true"></div>
              )}
              <div style={{ marginBottom:8 }}>
                <div className="category-label" style={{ fontSize:'0.95rem' }}>{it.name}</div>
              </div>
              <div style={{ fontSize:'0.85rem', fontWeight:600 }}>{typeof it.current_price === 'number' ? formatPrice(it.current_price) : '—'}</div>
            </div>
          ))}
          {(!loading && items.length === 0) && (
            <div style={{ textAlign: 'center', width: '100%', color: '#6b7280' }}>No knives found.</div>
          )}
        </div>
      )}
    </div>
  );
}
