import React, { useEffect, useMemo, useState, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useCurrency } from '../currency/CurrencyContext.jsx';

const API_BASE = 'http://127.0.0.1:8000';

export default function WeaponsPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [sortMode, setSortMode] = useState('rarity_desc');
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen] = useState(false);
  const boxRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { formatPrice } = useCurrency();

  // Define weapon categories
  const WEAPON_CATEGORIES = React.useMemo(() => [
    // Rifles
    { name: 'AK-47', imgSlug: 'ak-47' },
    { name: 'M4A4', imgSlug: 'm4a4' },
    { name: 'M4A1-S', imgSlug: 'm4a1-s' },
    { name: 'Galil AR', imgSlug: 'galil-ar' },
    { name: 'FAMAS', imgSlug: 'famas' },
    { name: 'AUG', imgSlug: 'aug' },
    { name: 'SG 553', imgSlug: 'sg-553' },
    { name: 'AWP', imgSlug: 'awp' },
    { name: 'SSG 08', imgSlug: 'ssg-08' },
    { name: 'G3SG1', imgSlug: 'g3sg1' },
    { name: 'SCAR-20', imgSlug: 'scar-20' },

    // Pistols
    { name: 'USP-S', imgSlug: 'usp-s' },
    { name: 'P2000', imgSlug: 'p2000' },
    { name: 'Glock-18', imgSlug: 'glock-18' },
    { name: 'Desert Eagle', imgSlug: 'desert-eagle' },
    { name: 'P250', imgSlug: 'p250' },
    { name: 'Five-SeveN', imgSlug: 'five-seven' },
    { name: 'Tec-9', imgSlug: 'tec-9' },
    { name: 'CZ75-Auto', imgSlug: 'cz75-auto' },
    { name: 'Dual Berettas', imgSlug: 'dual-berettas' },
    { name: 'R8 Revolver', imgSlug: 'r8-revolver' },

    // SMGs
    { name: 'MAC-10', imgSlug: 'mac-10' },
    { name: 'MP9', imgSlug: 'mp9' },
    { name: 'MP7', imgSlug: 'mp7' },
    { name: 'MP5-SD', imgSlug: 'mp5-sd' },
    { name: 'UMP-45', imgSlug: 'ump-45' },
    { name: 'P90', imgSlug: 'p90' },
    { name: 'PP-Bizon', imgSlug: 'pp-bizon' },

    // Heavy
    { name: 'Nova', imgSlug: 'nova' },
    { name: 'XM1014', imgSlug: 'xm1014' },
    { name: 'MAG-7', imgSlug: 'mag-7' },
    { name: 'Sawed-Off', imgSlug: 'sawed-off' },
    { name: 'M249', imgSlug: 'm249' },
    { name: 'Negev', imgSlug: 'negev' },

    // Other
    { name: 'Zeus x27', imgSlug: 'zeus-x27' },
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

  // Fetch suggestions
  useEffect(() => {
    const qTrim = query.trim();
    if (!qTrim) {
      setSuggestions([]);
      return;
    }
    // If query matches a category filter, skip suggestions
    const isCategoryFilter = WEAPON_CATEGORIES.some(c => query.startsWith(c.name + ' | '));
    if (isCategoryFilter) {
      setSuggestions([]);
      setOpen(false);
      return;
    }

    const t = setTimeout(async () => {
      try {
        const res = await fetch(`${API_BASE}/search/weapons?q=${encodeURIComponent(qTrim)}&limit=5`);
        if (res.ok) {
          const data = await res.json();
          const arr = Array.isArray(data) ? data : [];
          setSuggestions(arr);
          // Only open suggestions if the input is focused
          const input = boxRef.current?.querySelector('input');
          if (document.activeElement === input && arr.length > 0) {
            setOpen(true);
          }
        } else {
          setSuggestions([]);
        }
      } catch {
        setSuggestions([]);
      }
    }, 200);
    return () => clearTimeout(t);
  }, [query]);

  // Click outside to close
  useEffect(() => {
    const handleClick = (e) => {
      if (!boxRef.current) return;
      if (!boxRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    const handleKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, []);

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
        const url = `${API_BASE}/search/weapons?q=${encodeURIComponent(q)}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error('Failed to load weapons');
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
    // Scroll to top with a slight delay to override browser scroll restoration
    window.scrollTo(0, 0);
    setTimeout(() => window.scrollTo(0, 0), 0);
  }, [q]);

  const sortedItems = React.useMemo(() => {
    const arr = [...items];
    const getPrice = (c) => typeof c.current_price === 'number' ? c.current_price : 0;
    const getDate = (c) => c.release_date ? new Date(c.release_date) : new Date(0);
    const getRarityValue = (rarity) => {
      if (!rarity) return 0;
      const r = rarity.toLowerCase();
      if (r.includes('contraband')) return 7;
      if (r.includes('covert') || r.includes('extraordinary')) return 6;
      if (r.includes('classified')) return 5;
      if (r.includes('restricted')) return 4;
      if (r.includes('mil-spec')) return 3;
      if (r.includes('industrial')) return 2;
      if (r.includes('consumer')) return 1;
      return 0;
    };

    switch (sortMode) {
      case 'rarity_desc':
        arr.sort((a,b) => getRarityValue(b.rarity) - getRarityValue(a.rarity));
        break;
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
    const ql = (query || '').toLowerCase().trim();
    if (!ql) return arr;

    // Check if query starts with a known weapon category (e.g. "AK-47 | ")
    const categoryMatch = WEAPON_CATEGORIES.find(w => ql.startsWith(w.name.toLowerCase() + ' |'));
    let searchTokens = [];
    let baseFilter = null;

    if (categoryMatch) {
      const prefix = categoryMatch.name.toLowerCase() + ' |';
      baseFilter = (name) => name.startsWith(prefix);
      const remaining = ql.slice(prefix.length).trim();
      if (remaining) searchTokens = remaining.split(/\s+/).filter(Boolean);
    } else {
      searchTokens = ql.split(/\s+/).filter(Boolean);
    }

    return arr.filter(c => {
      const name = (c.name || '').toLowerCase();
      const slug = (c.slug || '').toLowerCase();

      if (baseFilter && !baseFilter(name)) return false;

      if (searchTokens.length === 0) return true;
      return searchTokens.every(token => name.includes(token) || slug.includes(token));
    });
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
        <h2 style={{ margin:0, flex:1, paddingLeft:'14%' }}>Weapons</h2>
        <div ref={boxRef} style={{ position: 'relative', width: 320, maxWidth: '100%' }}>
          <input
            className="search-input"
            type="text"
            placeholder="Search weapons..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => {
              const qTrim = query.trim();
              if (qTrim && suggestions.length > 0) setOpen(true);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                navigate(`?q=${encodeURIComponent(query)}`);
                setOpen(false);
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
                top: 10,
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
          {open && query && suggestions.length > 0 && (
            <div className="search-suggestions" style={{ top: '100%', left: 0, right: 0, width: '100%', zIndex: 100 }}>
              {suggestions.map((s) => (
                <button
                  key={s.slug}
                  onClick={() => {
                    navigate(`/skin/${s.slug}`);
                    setOpen(false);
                  }}
                  className="search-suggestion-row"
                >
                  {(() => {
                    const thumb = getSkinImage(s.slug);
                    return thumb ? (
                      <div className="search-thumb">
                        <img src={thumb} alt={s.name} />
                      </div>
                    ) : (
                      <div className="category-icon" aria-hidden="true"></div>
                    );
                  })()}
                  <div className="search-text">
                    <div className="search-name">{s.name}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
        <select value={sortMode} onChange={(e)=>setSortMode(e.target.value)} style={{
          background:'var(--surface-bg)', color:'var(--text-color)', border:'1px solid var(--border-color)', borderRadius:8, padding:'6px 8px'
        }}>
          <option value="rarity_desc">Rarity</option>
          <option value="price_desc">Price ↓</option>
          <option value="price_asc">Price ↑</option>
          <option value="release_new">Newest</option>
          <option value="release_old">Oldest</option>
        </select>
      </div>
      {loading && <div className="loading">Loading weapons…</div>}
      {error && <div className="loading" style={{ color:'tomato' }}>{error}</div>}
      {!q ? (
        <div className="categories-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
          {WEAPON_CATEGORIES.map(cat => (
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
            <div style={{ textAlign: 'center', width: '100%', color: '#6b7280' }}>No weapons found.</div>
          )}
        </div>
      )}
    </div>
  );
}
