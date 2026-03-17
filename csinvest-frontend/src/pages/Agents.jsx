import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useCurrency } from '../currency/CurrencyContext.jsx';
import { useAuth } from '../auth/AuthContext.jsx';
import { useAppModal } from '../components/AppModalProvider.jsx';
import { buildSteamInspectHref } from '../utils/inspect.js';
import { getCachedJson, invalidateCachedUrl } from '../utils/apiCache.js';
import { saveReturnTarget, restoreReturnTarget } from '../utils/returnTarget.js';

const API_BASE = '/api';

export default function AgentsPage() {
  const { user } = useAuth();
  const { showAlert } = useAppModal();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [sortMode, setSortMode] = useState('price_desc');
  const [query, setQuery] = useState('');
  const navigate = useNavigate();
  const location = useLocation();
  const { formatPrice } = useCurrency();

  const q = new URLSearchParams(location.search).get('q') || '';
  const returnScope = `agents:list:${q || 'all'}`;

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
        const data = await getCachedJson(url, { ttlMs: 180000 });
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

  useEffect(() => {
    if (loading) return;
    return restoreReturnTarget(returnScope, { block: 'center', maxTries: 50, intervalMs: 60 });
  }, [loading, items.length, returnScope]);

  const doRefreshPrices = async () => {
    const anyOutdated = items.some(i => {
      if (!i.current_price) return true;
      if (!i.last_update) return true;
      return (Date.now() - new Date(i.last_update).getTime()) > 3600000;
    });

    if (!anyOutdated && items.length > 0) {
       await showAlert('Prices are up to date (updated less than 1 hour ago).', { title: 'Price refresh' });
       return;
    }

    try {
      setRefreshing(true);
      await fetch(`${API_BASE}/refresh-items?item_type=agent`, { method: 'POST' });
      const url = query ? `${API_BASE}/search/items?q=${encodeURIComponent(query)}&item_type=agent` : `${API_BASE}/items?item_type=agent`;
      invalidateCachedUrl(url);
      const data = await getCachedJson(url, { ttlMs: 180000, force: true });
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

    const getRarityValue = (rarity) => {
      if (!rarity) return 0;
      const r = rarity.toLowerCase();
      if (r.includes('contraband')) return 7;
      if (r.includes('covert') || r.includes('extraordinary')) return 6;
      if (r.includes('classified') || r.includes('exotic')) return 5;
      if (r.includes('restricted') || r.includes('remarkable')) return 4;
      if (r.includes('mil-spec') || r.includes('high grade')) return 3;
      if (r.includes('industrial')) return 2;
      if (r.includes('consumer')) return 1;
      return 0;
    };

    switch (sortMode) {
      case 'price_asc':
        arr.sort((a,b) => getPrice(a) - getPrice(b));
        break;
      case 'price_desc':
        arr.sort((a,b) => getPrice(b) - getPrice(a));
        break;
      case 'rarity_desc':
        arr.sort((a,b) => getRarityValue(b.rarity) - getRarityValue(a.rarity));
        break;
      case 'rarity_asc':
        arr.sort((a,b) => getRarityValue(a.rarity) - getRarityValue(b.rarity));
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

  const WarningIcon = () => (
    <span style={{ 
      color: '#ff4d4d', 
      fontWeight: 'bold', 
      cursor: 'help',
      fontSize: '16px',
      marginLeft: 4,
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

  return (
    <div className="dashboard-container search-page">
      <div className="search-page-toolbar">
        <button onClick={() => navigate(-1)} aria-label="Back" style={{
          background:'var(--button-bg)', color:'var(--button-text)', border:'1px solid var(--border-color)', borderRadius:10, padding:'6px 10px', cursor:'pointer'
        }}>←</button>
        <h2 className="search-page-title">Agents</h2>
        <div className="search-page-search-wrap">
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
        <select className="search-page-sort" value={sortMode} onChange={(e)=>setSortMode(e.target.value)} style={{
          background:'var(--surface-bg)', color:'var(--text-color)', border:'1px solid var(--border-color)', borderRadius:8, padding:'6px 8px'
        }}>
          <option value="price_desc">Price ↓</option>
          <option value="price_asc">Price ↑</option>
          <option value="rarity_desc">Rarity ↓</option>
          <option value="rarity_asc">Rarity ↑</option>
        </select>
        {user && (
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
        )}
      </div>
      {loading && <div className="loading">Loading agents…</div>}
      {error && <div className="loading" style={{ color:'tomato' }}>{error}</div>}
      <div className="categories-grid search-page-grid">
        {sortedItems.map(it => (
          <Link
            key={it.slug}
            className="category-card item-card"
            to={`/skin/${it.slug}`}
            data-return-id={it.slug}
            onClick={() => saveReturnTarget(returnScope, it.slug)}
            style={{ cursor: 'pointer', position: 'relative', textDecoration: 'none', color: 'inherit' }}
          >
            {(() => {
              const inspectHref = buildSteamInspectHref(it.inspect, it);
              return (
              <button
                type="button"
                className="icon-btn"
                title="Inspect in game"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (inspectHref) window.location.href = inspectHref;
                }}
                style={{ position: 'absolute', top: 8, right: 8, zIndex: 3, border: '1px solid var(--border-color)', borderRadius: 8, width: 28, height: 28, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', opacity: inspectHref ? 1 : 0.45, cursor: inspectHref ? 'pointer' : 'not-allowed' }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="11" cy="11" r="7" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              </button>
              );
            })()}
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
            <div style={{ fontSize:'0.85rem', fontWeight:600 }} title={`Last update: ${it.last_update ? new Date(it.last_update).toLocaleString() : 'Never'}`}>
              {typeof it.current_price === 'number' ? formatPrice(it.current_price) : '—'}
              {isPriceOutdated(it.last_update) && <WarningIcon />}
            </div>
          </Link>
        ))}
        {(!loading && items.length === 0) && (
          <div style={{ textAlign: 'center', width: '100%', color: '#6b7280' }}>No agents found.</div>
        )}
      </div>
    </div>
  );
}
