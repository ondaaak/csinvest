import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useCurrency } from '../currency/CurrencyContext.jsx';

const BASE_URL = 'http://127.0.0.1:8000';

function CollectionsPage() {
  const [collections, setCollections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [sortMode, setSortMode] = useState('release_new');
  const [query, setQuery] = useState('');
  const navigate = useNavigate();
  const { formatPrice } = useCurrency();

  // We can try to load images if they exist, or just use placeholders
  const collectionImgMap = useMemo(() => {
    // Assuming we might have collection images in the future, or reuse case images if applicable
    // For now, this might return empty or unmatched if filenames don't match
    const files = import.meta.glob('../assets/collections/*.{png,jpg,jpeg,webp,svg}', { eager: true, query: '?url', import: 'default' });
    const map = {};
    Object.entries(files).forEach(([path, url]) => {
      const filename = path.split('/').pop() || '';
      const base = filename.substring(0, filename.lastIndexOf('.'));
      map[base.toLowerCase()] = url;
    });
    return map;
  }, []);

  const getCollectionImage = (slug) => {
    if (!slug) return null;
    // Try exact match
    if (collectionImgMap[slug]) return collectionImgMap[slug];
    // Try matching start
    const k = Object.keys(collectionImgMap).find(key => slug.startsWith(key));
    return k ? collectionImgMap[k] : null;
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await axios.get(`${BASE_URL}/collections`);
        const arr = Array.isArray(res.data) ? res.data : [];
        setCollections(arr);
      } catch (e) {
        console.error(e);
        setError('Failed to load collections');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const doRefreshPrices = async () => {
    try {
      setRefreshing(true);
      // Assuming refresh-items can handle 'collection' or we just refresh 'skin' which updates collections too?
      // The backend refresh_items takes item_type. If we pass 'collection', it might not be implemented yet.
      // But usually collections are just containers of skins.
      // For now let's just refresh the list.
      const res = await axios.get(`${BASE_URL}/collections`);
      const arr = Array.isArray(res.data) ? res.data : [];
      setCollections(arr);
    } catch (e) {
      console.error(e);
    } finally {
      setRefreshing(false);
    }
  };

  const sortedCollections = useMemo(() => {
    const arr = [...collections];
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

    const q = query.trim().toLowerCase();
    const filtered = q
      ? arr.filter(c => (c.name || '').toLowerCase().includes(q) || (c.slug || '').toLowerCase().includes(q))
      : arr;
    return filtered;
  }, [collections, sortMode, query]);

  const badgeColors = (dt) => {
    switch ((dt || '').toLowerCase()) {
      case 'active':
        return { bg:'rgba(34,197,94,0.18)', color:'var(--profit-color)' };
      case 'obtainable':
        return { bg:'rgba(234,179,8,0.25)', color:'#fbbf24' };
      case 'not-obtainable':
        return { bg:'rgba(239,68,68,0.18)', color:'var(--loss-color)' };
      default:
        return { bg:'rgba(107,114,128,0.25)', color:'var(--text-color)' };
    }
  };

  if (loading) {
    return <div className="dashboard-container"><div className="loading">Loading collections…</div></div>;
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
        <h2 style={{ margin:0, flex:1, paddingLeft:'14%' }}>Collections</h2>
        <div style={{ position: 'relative', width: 320, maxWidth: '100%' }}>
          <input
            className="search-input"
            type="text"
            placeholder="Search collections..."
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
          <option value="release_new">Newest</option>
          <option value="release_old">Oldest</option>
          <option value="price_desc">Price ↓</option>
          <option value="price_asc">Price ↑</option>
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
        >{refreshing ? 'Refreshing…' : 'Refresh'}</button>
      </div>

      <div className="categories-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))' }}>
        {sortedCollections.map(c => {
          const badge = badgeColors(c.drop_type);
          return (
            <div
              key={c.slug}
              className="category-card item-card"
              onClick={() => navigate(`/collection/${c.slug}`)}
              style={{ cursor: 'pointer', position: 'relative', aspectRatio: '1/1' }}
            >
              {getCollectionImage(c.slug) ? (
                <img src={getCollectionImage(c.slug)} alt={c.name} className="category-img" />
              ) : (
                <div className="category-icon" aria-hidden="true"></div>
              )}
              <div className="category-label">{c.name}</div>
              {c.drop_type && (
                <div style={{ marginTop: 4 }}>
                  <span style={{
                    display:'inline-block',
                    fontSize:'0.65rem',
                    padding:'3px 6px',
                    borderRadius:6,
                    background: badge.bg,
                    color: badge.color,
                    fontWeight:600,
                    textTransform:'uppercase'
                  }}>
                    {c.drop_type.replace('-', ' ')}
                  </span>
                </div>
              )}
              <div style={{ fontSize:'0.85rem', fontWeight:600, marginTop:4 }}>
                {c.current_price ? formatPrice(c.current_price) : '—'}
              </div>
            </div>
          );
        })}
        {(!loading && collections.length === 0) && (
          <div style={{ textAlign: 'center', width: '100%', color: '#6b7280' }}>No collections found.</div>
        )}
      </div>
    </div>
  );
}

export default CollectionsPage;
