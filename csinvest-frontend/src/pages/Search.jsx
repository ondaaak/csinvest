import React, { useEffect, useMemo, useState, useRef } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { buildSteamInspectHref, shouldShowInspect } from '../utils/inspect.js';
const API_BASE = '/api';

const CATEGORIES = [
  { key: 'cases', label: 'Cases' },
  { key: 'collections', label: 'Collections' },
  { key: 'knives', label: 'Knives' },
  { key: 'gloves', label: 'Gloves' },
  { key: 'weapons', label: 'Weapons' },
  { key: 'agents', label: 'Agents' },
  { key: 'stickers', label: 'Stickers' },
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
  const [thumbUrls, setThumbUrls] = useState({});
  const boxRef = useRef(null);
  const location = useLocation();

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
  const skinsGlob = useMemo(() => import.meta.glob('../assets/skins/*.{png,jpg,jpeg,svg,webp}', { query: '?url', import: 'default' }), []);
  const casesGlob = useMemo(() => import.meta.glob('../assets/cases/*.{png,jpg,jpeg,svg,webp}', { query: '?url', import: 'default' }), []);
  const assetLoadersFromFolder = (globObj) => Object.fromEntries(
    Object.entries(globObj).map(([p, loader]) => {
      const filename = p.split('/').pop() || '';
      const keyRaw = filename.substring(0, filename.lastIndexOf('.'));
      return [slugNormalize(keyRaw), loader];
    })
  );
  const itemThumbLoaders = useMemo(() => ({
    ...assetLoadersFromFolder(skinsGlob),
    ...assetLoadersFromFolder(casesGlob),
  }), [skinsGlob, casesGlob]);

  const sortedThumbKeys = useMemo(() => Object.keys(itemThumbLoaders).sort((a, b) => b.length - a.length), [itemThumbLoaders]);

  useEffect(() => {
    if (!suggestions.length) return;

    const missing = suggestions
      .map((s) => slugNormalize(s.slug))
      .filter((slug) => slug && !thumbUrls[slug]);

    if (!missing.length) return;

    let cancelled = false;

    const loadThumb = async (slug) => {
      const directLoader = itemThumbLoaders[slug];
      const matchedKey = directLoader ? slug : (sortedThumbKeys.find((k) => slug.startsWith(k)) || null);
      const loader = directLoader || (matchedKey ? itemThumbLoaders[matchedKey] : null);
      if (!loader) return;

      try {
        const url = await loader();
        if (!cancelled && typeof url === 'string') {
          setThumbUrls((prev) => {
            if (prev[slug]) return prev;
            return { ...prev, [slug]: url };
          });
        }
      } catch {
        // Ignore missing/broken assets and keep placeholder image.
      }
    };

    missing.forEach((slug) => {
      void loadThumb(slug);
    });

    return () => {
      cancelled = true;
    };
  }, [suggestions, itemThumbLoaders, sortedThumbKeys, thumbUrls]);

  const getThumb = (slug) => {
    if (!slug) return null;
    const normalized = slugNormalize(slug);
    if (thumbUrls[normalized]) return thumbUrls[normalized];
    const match = sortedThumbKeys.find(k => normalized.startsWith(k));
    return match ? thumbUrls[match] || null : null;
  };

  const categoryHref = (cat) => {
    const qs = query.trim() ? `?q=${encodeURIComponent(query.trim())}` : '';
    return `/search/${cat.key}${qs}`;
  };

  const itemHref = (item) => (item.item_type === 'case' ? `/case/${item.slug}` : `/skin/${item.slug}`);
  const scrollKey = `scroll:${location.pathname}${location.search}`;

  useEffect(() => {
    const saved = sessionStorage.getItem(scrollKey);
    if (saved) {
      const y = Number(saved);
      if (Number.isFinite(y) && y >= 0) {
        requestAnimationFrame(() => window.scrollTo(0, y));
      }
    }

    const onScroll = () => {
      sessionStorage.setItem(scrollKey, String(window.scrollY || window.pageYOffset || 0));
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      onScroll();
      window.removeEventListener('scroll', onScroll);
    };
  }, [scrollKey]);

  useEffect(() => {
    const q = query.trim();
    if (!q) { setSuggestions([]); return; }
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
                (() => {
                  const inspectHref = shouldShowInspect(s) ? buildSteamInspectHref(s.inspect, s) : null;
                  return (
                    <div
                      key={s.slug}
                      className="search-suggestion-row"
                      style={{ display: 'grid', gridTemplateColumns: '1fr 28px', alignItems: 'center', gap: 8 }}
                    >
                      <Link
                        to={itemHref(s)}
                        onClick={() => {
                          setOpen(false);
                        }}
                        style={{ display: 'grid', gridTemplateColumns: '64px 1fr', alignItems: 'center', gap: 10, minWidth: 0, textDecoration: 'none', color: 'inherit' }}
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
                        <div className="search-text" style={{ width: '100%' }}>
                          <div className="search-name">{s.name}</div>
                          <div className="search-type">{s.item_type}</div>
                        </div>
                      </Link>
                      <div style={{ width: 28, height: 28, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                        {inspectHref && (
                          <button
                            type="button"
                            className="icon-btn"
                            title="Inspect in game"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              if (inspectHref) window.location.href = inspectHref;
                            }}
                            style={{ flexShrink: 0, border: '1px solid var(--border-color)', borderRadius: 8, width: 28, height: 28, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <circle cx="11" cy="11" r="7" />
                              <line x1="21" y1="21" x2="16.65" y2="16.65" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })()
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
            c.disabled ? (
              <button
                key={c.key}
                className="category-card disabled-category"
                disabled
                style={{ opacity: 0.5, cursor: 'not-allowed', filter: 'grayscale(100%)' }}
              >
                {src ? (
                  <img className="category-img" src={src} alt={c.label} />
                ) : (
                  <div className="category-icon" aria-hidden="true"></div>
                )}
                <div className="category-label">{c.label}</div>
              </button>
            ) : (
              <Link
                key={c.key}
                className="category-card"
                to={categoryHref(c)}
                style={{ textDecoration: 'none', color: 'inherit' }}
              >
                {src ? (
                  <img className="category-img" src={src} alt={c.label} />
                ) : (
                  <div className="category-icon" aria-hidden="true"></div>
                )}
                <div className="category-label">{c.label}</div>
              </Link>
            )
          );
        })}
      </div>
    </div>
  );
}

export default SearchPage;
