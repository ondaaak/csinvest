import React, { useEffect, useMemo, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
const API_BASE = 'http://127.0.0.1:8000';

const CATEGORIES = [
  { key: 'cases', label: 'Cases' },
  { key: 'collections', label: 'Collections' },
  { key: 'knives', label: 'Knives' },
  { key: 'gloves', label: 'Gloves' },
  { key: 'weapons', label: 'Weapons' },
  { key: 'agents', label: 'Agents' },
  { key: 'stickers', label: 'Stickers', disabled: true },
  { key: 'charms', label: 'Charms' },
  { key: 'patches', label: 'Patches', disabled: true },
  { key: 'pins', label: 'Pins', disabled: true },
  { key: 'graffities', label: 'Graffities', disabled: true },
  { key: 'music-kits', label: 'Music kits', disabled: true },
  { key: 'passes', label: 'Passes', disabled: true },
  { key: 'medals', label: 'Medals', disabled: true },
  { key: 'other', label: 'Other', disabled: true },
];

function SearchPage() {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const boxRef = useRef(null);
  const navigate = useNavigate();

  const normalize = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const glob = import.meta.glob('../assets/search/*.{png,jpg,jpeg,svg,webp}', { eager: true, query: '?url', import: 'default' });
  const imgMap = Object.fromEntries(
    Object.entries(glob).map(([p, url]) => {
      const filename = p.split('/').pop() || '';
      const keyRaw = filename.substring(0, filename.lastIndexOf('.'));
      return [normalize(keyRaw), url];
    })
  );

  const slugNormalize = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  const skinsGlob = import.meta.glob('../assets/skins/*.{png,jpg,jpeg,svg,webp}', { eager: true, query: '?url', import: 'default' });
  // Gloves are now in skins folder
  const casesGlob = import.meta.glob('../assets/cases/*.{png,jpg,jpeg,svg,webp}', { eager: true, query: '?url', import: 'default' });
  const assetFromFolder = (globObj) => Object.fromEntries(
    Object.entries(globObj).map(([p, url]) => {
      const filename = p.split('/').pop() || '';
      const keyRaw = filename.substring(0, filename.lastIndexOf('.'));
      return [slugNormalize(keyRaw), url];
    })
  );
  const itemThumbs = useMemo(() => ({
    ...assetFromFolder(skinsGlob),
    ...assetFromFolder(casesGlob),
  }), []);

  const sortedThumbKeys = useMemo(() => Object.keys(itemThumbs).sort((a, b) => b.length - a.length), [itemThumbs]);

  const getThumb = (slug) => {
    if (!slug) return null;
    if (itemThumbs[slug]) return itemThumbs[slug];
    const match = sortedThumbKeys.find(k => slug.startsWith(k));
    return match ? itemThumbs[match] : null;
  };

  const onCategoryClick = (cat) => {
    const qs = query.trim() ? `?q=${encodeURIComponent(query.trim())}` : '';
    navigate(`/search/${cat.key}${qs}`);
  };

  useEffect(() => {
    const q = query.trim();
    if (!q) { setSuggestions([]); return; }
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`${API_BASE}/search?q=${encodeURIComponent(q)}&limit=8`);
        if (res.ok) {
          const data = await res.json();
          const arr = Array.isArray(data) ? data : [];
          // Filter out cash item from general search suggestions
          const filtered = arr.filter(i => i.slug !== 'cash' && i.name !== 'cash');
          setSuggestions(filtered);
          setOpen(filtered.length > 0);
        } else {
          setSuggestions([]);
          setOpen(false);
        }
      } catch {
        setSuggestions([]);
        setOpen(false);
      } finally {
        setLoading(false);
      }
    }, 200);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    const handleClick = (e) => {
      if (!boxRef.current) return;
      if (!boxRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    const handleKey = (e) => {
      if (e.key === 'Escape') {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, []);

  return (
    <div className="dashboard-container">
      <h2 style={{ textAlign: 'center' }}>Search any item</h2>

      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <div ref={boxRef} style={{ position:'relative', width:'100%', maxWidth:600 }}>
          <input
            className="search-input"
            placeholder="Search..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => {
              if (query.trim() && suggestions.length > 0) setOpen(true);
            }}
            style={{ paddingRight: 30 }}
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              style={{
                position: 'absolute',
                right: 10,
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'transparent',
                border: 'none',
                color: 'var(--text-color)',
                fontSize: '1.2rem',
                cursor: 'pointer',
                padding: 0,
                lineHeight: 1,
                zIndex: 5
              }}
              aria-label="Clear search"
            >
              ×
            </button>
          )}
          {open && query && suggestions.length > 0 && (
            <div className="search-suggestions">
              {suggestions.map((s) => (
                <button
                  key={s.slug}
                  onClick={() => {
                    navigate(s.item_type === 'case' ? `/case/${s.slug}` : `/skin/${s.slug}`);
                    setOpen(false);
                  }}
                  className="search-suggestion-row"
                >
                  {(() => {
                    const thumb = getThumb(s.slug);
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
                    <div className="search-type">{s.item_type}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="categories-grid">
        {CATEGORIES.map((c) => {
          const keyNorm = normalize(c.key);
          const aliases = [keyNorm];
          if (keyNorm === 'graffities') aliases.push('graffiti', 'graffitis');
          if (keyNorm === 'musickits') aliases.push('musickits', 'music_kits', 'musickit');
          let src = undefined;
          for (const k of aliases) { if (imgMap[k]) { src = imgMap[k]; break; } }
          return (
            <button
              key={c.key}
              className={`category-card ${c.disabled ? 'disabled-category' : ''}`}
              onClick={() => !c.disabled && onCategoryClick(c)}
              disabled={c.disabled}
              style={c.disabled ? { opacity: 0.5, cursor: 'not-allowed', filter: 'grayscale(100%)' } : {}}
            >
              {src ? (
                <img className="category-img" src={src} alt={c.label} />
              ) : (
                <div className="category-icon" aria-hidden="true"></div>
              )}
              <div className="category-label">{c.label}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default SearchPage;
