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
  const [showHelp, setShowHelp] = useState(false);
  const [sortMode, setSortMode] = useState('release_new');
  const [query, setQuery] = useState('');
  const navigate = useNavigate();
  const { formatPrice } = useCurrency();


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

    const q = query.trim().toLowerCase();
    const filtered = q
      ? arr.filter(c => (c.name || '').toLowerCase().includes(q) || (c.slug || '').toLowerCase().includes(q))
      : arr;
    return filtered;
  }, [cases, sortMode, query]);

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
        <div style={{ position: 'relative', width: 320, maxWidth: '100%' }}>
          <input
            className="search-input"
            type="text"
            placeholder="Search cases..."
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
          onClick={() => setShowHelp(true)}
          style={{
            background: 'var(--surface-bg)',
            color: 'var(--text-color)',
            border: '1px solid var(--border-color)',
            width: 36,
            height: 36,
            borderRadius: '50%',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.2rem',
            fontWeight: 'bold'
          }}
          title="How cases work"
        >
          ?
        </button>
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
      <div className="categories-grid" style={{ gridTemplateColumns: 'repeat(6, 1fr)' }}>
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
            <div style={{ marginBottom:8 }}>
              <div className="category-label" style={{ fontSize:'0.95rem' }}>{cs.name}</div>
              {(() => { const c = badgeColors(cs.drop_type); return (
                <span style={{
                  display:'inline-block',
                  marginTop:6,
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
            <div style={{ fontSize:'0.85rem', fontWeight:600 }} title={`Last update: ${cs.last_update ? new Date(cs.last_update).toLocaleString() : 'Never'}`}>
              {formatPrice(cs.current_price)}
              {isPriceOutdated(cs.last_update) && <WarningIcon />}
            </div>
          </div>
        ))}
      </div>

      {showHelp && (
        <div className="modal-overlay" onClick={() => setShowHelp(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 600 }}>
            <div className="modal-header" style={{ position: 'relative' }}>
              <h3 style={{ margin: 0 }}>How Do Cases Work</h3>
              <button 
                onClick={() => setShowHelp(false)} 
                style={{
                  position: 'absolute', 
                  right: 0, 
                  top: -4, 
                  background: 'transparent', 
                  border: 'none', 
                  color: 'var(--text-color)', 
                  fontSize: '1.5rem', 
                  cursor: 'pointer',
                  lineHeight: 1
                }}
              >
                ×
              </button>
            </div>
            
            <div className="modal-body">
              <p style={{ opacity: 0.85, lineHeight: 1.5, marginBottom: 20 }}>
                Cases contain skins of different rarities. When you open a case, you have a specific probability to receive an item of a certain grade.
                To open a case you need to buy a key in-game. Tradable keys on market are overpriced collector items from the past.
              </p>
              
              <div className="stat-card" style={{ background:'transparent', boxShadow:'none', color:'inherit', fontSize:'0.9rem', padding: 0 }}>
                <strong>Odds:</strong>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(180px, 1fr))', gap:8, marginTop:8 }}>
                  <div><span className="badge milspec">Mil‑Spec</span> 1 in 1.25 → 80.00%</div>
                  <div><span className="badge restricted">Restricted</span> 1 in 6.26 → 15.97%</div>
                  <div><span className="badge classified">Classified</span> 1 in 31.28 → 3.20%</div>
                  <div><span className="badge covert">Covert</span> 1 in 156.4 → 0.64%</div>
                  <div><span className="badge contraband">Gold</span> 1 in 391 → 0.26%</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default CasesPage;
    