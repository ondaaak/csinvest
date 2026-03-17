import React, { useEffect, useMemo, useState, useRef } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import { buildSteamInspectHref } from '../utils/inspect.js';
import { getCachedJson } from '../utils/apiCache.js';
import { saveReturnTarget, restoreReturnTarget } from '../utils/returnTarget.js';

const API_BASE = '/api';
const WEAPONS_FILTERS_STORAGE_KEY = 'csinvest:weapons:filters:v2';

const getDefaultFilters = () => ({
  selectedRarities: [],
  floatFilterEnabled: false,
  minFloat: 0,
  maxFloat: 1,
  onlyCaseSkins: false,
  onlyCollectionSkins: false,
});

const readStoredFilters = () => {
  try {
    const raw = localStorage.getItem(WEAPONS_FILTERS_STORAGE_KEY);
    if (!raw) return getDefaultFilters();
    const parsed = JSON.parse(raw);
    return {
      selectedRarities: Array.isArray(parsed.selectedRarities) ? parsed.selectedRarities.filter(v => typeof v === 'string') : [],
      floatFilterEnabled: !!parsed.floatFilterEnabled,
      minFloat: typeof parsed.minFloat === 'number' ? Math.max(0, Math.min(parsed.minFloat, 1)) : 0,
      maxFloat: typeof parsed.maxFloat === 'number' ? Math.max(0, Math.min(parsed.maxFloat, 1)) : 1,
      onlyCaseSkins: !!parsed.onlyCaseSkins,
      onlyCollectionSkins: !!parsed.onlyCollectionSkins,
    };
  } catch {
    return getDefaultFilters();
  }
};

export default function WeaponsPage() {
  const { user } = useAuth();
  const canUseFilters = !!user;
  const initialFilters = useMemo(() => readStoredFilters(), []);

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [sortMode, setSortMode] = useState('rarity_desc');
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedRarities, setSelectedRarities] = useState(initialFilters.selectedRarities);
  const [floatFilterEnabled, setFloatFilterEnabled] = useState(initialFilters.floatFilterEnabled);
  const [minFloat, setMinFloat] = useState(initialFilters.minFloat);
  const [maxFloat, setMaxFloat] = useState(initialFilters.maxFloat);
  const [onlyCaseSkins, setOnlyCaseSkins] = useState(initialFilters.onlyCaseSkins);
  const [onlyCollectionSkins, setOnlyCollectionSkins] = useState(initialFilters.onlyCollectionSkins);
  const boxRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();

  const persistFiltersNow = (payload) => {
    if (!canUseFilters) return;
    try {
      localStorage.setItem(WEAPONS_FILTERS_STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // Ignore storage write errors.
    }
  };

  const RARITY_OPTIONS = useMemo(() => [
    { key: 'contraband', label: 'Contraband' },
    { key: 'covert', label: 'Covert / Extraordinary' },
    { key: 'classified', label: 'Classified' },
    { key: 'restricted', label: 'Restricted' },
    { key: 'mil-spec', label: 'Mil-Spec' },
    { key: 'industrial', label: 'Industrial' },
    { key: 'consumer', label: 'Consumer' },
  ], []);

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
  const categoryReturnScope = 'weapons:categories';
  const itemReturnScope = `weapons:items:${q || 'all'}`;
  const showAllWeapons = q.toLowerCase() === 'all';
  const activeWeaponType = useMemo(() => {
    const ql = (q || '').toLowerCase().trim();
    const match = WEAPON_CATEGORIES.find(w => ql.startsWith(`${w.name.toLowerCase()} |`));
    return match ? match.name : null;
  }, [q, WEAPON_CATEGORIES]);

  const openSkinDetail = (itemSlug) => {
    saveReturnTarget(itemReturnScope, itemSlug);
    persistFiltersNow({
      selectedRarities,
      floatFilterEnabled,
      minFloat,
      maxFloat,
      onlyCaseSkins,
      onlyCollectionSkins,
    });
    navigate(`/skin/${itemSlug}`, {
      state: {
        fromSearchHierarchy: {
          section: 'weapons',
          sectionLabel: 'Weapons',
          type: activeWeaponType,
        },
      },
    });
  };

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
        const res = await fetch(`${API_BASE}/weapons?q=${encodeURIComponent(qTrim)}&limit=5`);
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
      if (e.key === 'Escape') setShowFilters(false);
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, []);

  useEffect(() => {
    persistFiltersNow({
      selectedRarities,
      floatFilterEnabled,
      minFloat,
      maxFloat,
      onlyCaseSkins,
      onlyCollectionSkins,
    });
  }, [selectedRarities, floatFilterEnabled, minFloat, maxFloat, onlyCaseSkins, onlyCollectionSkins, canUseFilters]);

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
        const url = showAllWeapons ? `${API_BASE}/weapons` : `${API_BASE}/weapons?q=${encodeURIComponent(q)}`;
        const data = await getCachedJson(url, { ttlMs: 180000 });
        const arr = Array.isArray(data) ? data : [];
        setItems(arr);
        setQuery(showAllWeapons ? '' : q);
      } catch (e) {
        setError(e.message || 'Error');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [q, showAllWeapons]);

  useEffect(() => {
    if (q) {
      if (loading) return;
      return restoreReturnTarget(itemReturnScope, { block: 'center', maxTries: 50, intervalMs: 60 });
    }
    return restoreReturnTarget(categoryReturnScope, { block: 'center', maxTries: 20, intervalMs: 60 });
  }, [q, loading, items.length, itemReturnScope]);

  const normalizeRarityKey = (rarity) => {
    if (!rarity) return null;
    const r = rarity.toLowerCase();
    if (r.includes('contraband')) return 'contraband';
    if (r.includes('covert') || r.includes('extraordinary')) return 'covert';
    if (r.includes('classified')) return 'classified';
    if (r.includes('restricted')) return 'restricted';
    if (r.includes('mil-spec')) return 'mil-spec';
    if (r.includes('industrial')) return 'industrial';
    if (r.includes('consumer')) return 'consumer';
    return null;
  };

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

  const getItemFloatRange = (item) => {
    const min = Number(item?.min_float);
    const max = Number(item?.max_float);
    if (!Number.isNaN(min) && !Number.isNaN(max) && min >= 0 && max <= 1 && min <= max) {
      return { min, max };
    }
    const single = Number(item?.float_value ?? item?.float ?? item?.wear);
    if (!Number.isNaN(single) && single >= 0 && single <= 1) {
      return { min: single, max: single };
    }
    return null;
  };

  const hasCaseId = (item) => item?.case_id !== null && item?.case_id !== undefined;

  const getSkinSource = (item) => {
    return hasCaseId(item) ? 'case' : 'collection';
  };

  const sortedItems = React.useMemo(() => {
    let arr = [...items];

    const ql = (query || '').toLowerCase().trim();

    if (ql) {
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

      arr = arr.filter(c => {
        const name = (c.name || '').toLowerCase();
        const slug = (c.slug || '').toLowerCase();

        if (baseFilter && !baseFilter(name)) return false;

        if (searchTokens.length === 0) return true;
        return searchTokens.every(token => name.includes(token) || slug.includes(token));
      });
    }

    if (canUseFilters && selectedRarities.length > 0) {
      arr = arr.filter(c => {
        const rarityKey = normalizeRarityKey(c.rarity);
        return rarityKey && selectedRarities.includes(rarityKey);
      });
    }

    if (canUseFilters && floatFilterEnabled) {
      arr = arr.filter(c => {
        const range = getItemFloatRange(c);
        if (range == null) return false;

        const eps = 0.000001;
        const fullRangeOnly = minFloat <= eps && maxFloat >= 1 - eps;
        if (fullRangeOnly) {
          return range.min <= eps && range.max >= 1 - eps;
        }

        return range.min >= minFloat - eps && range.max <= maxFloat + eps;
      });
    }

    if (canUseFilters && (onlyCaseSkins || onlyCollectionSkins)) {
      arr = arr.filter(c => {
        const source = getSkinSource(c);
        return (onlyCaseSkins && source === 'case') || (onlyCollectionSkins && source === 'collection');
      });
    }

    switch (sortMode) {
      case 'rarity_desc':
        arr.sort((a, b) => getRarityValue(b.rarity) - getRarityValue(a.rarity));
        break;
      case 'rarity_asc':
        arr.sort((a, b) => getRarityValue(a.rarity) - getRarityValue(b.rarity));
        break;
      default:
        break;
    }

    return arr;
  }, [
    items,
    sortMode,
    query,
    WEAPON_CATEGORIES,
    selectedRarities,
    floatFilterEnabled,
    minFloat,
    maxFloat,
    onlyCaseSkins,
    onlyCollectionSkins,
  ]);

  const activeFilterCount = canUseFilters
    ? selectedRarities.length + (floatFilterEnabled ? 1 : 0) + (onlyCaseSkins ? 1 : 0) + (onlyCollectionSkins ? 1 : 0)
    : 0;

  const toggleRarity = (rarityKey) => {
    setSelectedRarities(prev => prev.includes(rarityKey) ? prev.filter(r => r !== rarityKey) : [...prev, rarityKey]);
  };

  const resetFilters = () => {
    setSelectedRarities([]);
    setFloatFilterEnabled(false);
    setMinFloat(0);
    setMaxFloat(1);
    setOnlyCaseSkins(false);
    setOnlyCollectionSkins(false);
  };

  const updateMinFloat = (nextRaw) => {
    const next = Math.max(0, Math.min(Number(nextRaw), maxFloat));
    setMinFloat(Number.isNaN(next) ? 0 : next);
  };

  const updateMaxFloat = (nextRaw) => {
    const next = Math.min(1, Math.max(Number(nextRaw), minFloat));
    setMaxFloat(Number.isNaN(next) ? 1 : next);
  };

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
    <div className="dashboard-container search-page">
      <div className="search-page-toolbar">
        <button onClick={() => navigate(-1)} aria-label="Back" style={{
          background:'var(--button-bg)', color:'var(--button-text)', border:'1px solid var(--border-color)', borderRadius:10, padding:'6px 10px', cursor:'pointer'
        }}>←</button>
        <div className="search-page-title" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.95rem' }}>
          <button
            type="button"
            onClick={() => navigate('/search/weapons')}
            style={{ background: 'transparent', border: 'none', color: 'var(--text-color)', padding: 0, cursor: 'pointer', fontSize: '0.95rem' }}
          >
            Weapons
          </button>
          {activeWeaponType && (
            <>
              <span style={{ opacity: 0.7 }}>|</span>
              <span style={{ fontSize: '0.95rem', opacity: 0.9 }}>{activeWeaponType}</span>
            </>
          )}
          {showAllWeapons && (
            <>
              <span style={{ opacity: 0.7 }}>|</span>
              <span style={{ fontSize: '0.95rem', opacity: 0.9 }}>All</span>
            </>
          )}
        </div>
        {canUseFilters && (
          <button
            type="button"
            onClick={() => setShowFilters(true)}
            style={{
              background:'var(--surface-bg)',
              color:'var(--text-color)',
              border:'1px solid var(--border-color)',
              borderRadius:8,
              padding:'6px 10px',
              cursor:'pointer'
            }}
          >
            Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
          </button>
        )}
        <div ref={boxRef} className="search-page-search-wrap">
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
                    openSkinDetail(s.slug);
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
        <select className="search-page-sort" value={sortMode} onChange={(e)=>setSortMode(e.target.value)} style={{
          background:'var(--surface-bg)', color:'var(--text-color)', border:'1px solid var(--border-color)', borderRadius:8, padding:'6px 8px'
        }}>
          <option value="rarity_desc">Rarity ↓</option>
          <option value="rarity_asc">Rarity ↑</option>
        </select>
      </div>
      {canUseFilters && showFilters && (
        <div className="modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) setShowFilters(false); }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 560 }}>
            <div className="modal-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <h3 style={{ margin: 0 }}>Filters</h3>
              <button
                type="button"
                onClick={() => setShowFilters(false)}
                aria-label="Close filters"
                style={{ background: 'transparent', border: 'none', color: 'var(--text-color)', fontSize: '1.2rem', cursor: 'pointer' }}
              >
                ×
              </button>
            </div>

            <div style={{ display: 'grid', gap: 18 }}>
              <section>
                <div style={{ fontWeight: 600, marginBottom: 8 }}>Rarity</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
                  {RARITY_OPTIONS.map((opt) => {
                    const color = getRarityColor(opt.label);
                    const checked = selectedRarities.includes(opt.key);
                    return (
                      <label key={opt.key} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: '6px 8px', borderRadius: 8, border: '1px solid var(--surface-border)' }}>
                        <input
                          type="checkbox"
                          className="filter-checkbox"
                          checked={checked}
                          onChange={() => toggleRarity(opt.key)}
                        />
                        <span style={{
                          display: 'inline-block',
                          fontSize: '0.72rem',
                          padding: '3px 6px',
                          borderRadius: 6,
                          background: color.bg,
                          color: color.color,
                          fontWeight: 600,
                        }}>
                          {opt.label}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </section>

              <section>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    className="filter-checkbox"
                    checked={floatFilterEnabled}
                    onChange={(e) => setFloatFilterEnabled(e.target.checked)}
                  />
                  <span style={{ fontWeight: 600 }}>Float range</span>
                </label>

                <div className="skin-float-range" style={{ opacity: floatFilterEnabled ? 1 : 0.45, pointerEvents: floatFilterEnabled ? 'auto' : 'none' }}>
                  <div style={{ position: 'relative', height: 34, marginBottom: 8 }}>
                    <div style={{ position: 'absolute', left: 0, right: 0, top: 13, height: 8, borderRadius: 999, background: 'linear-gradient(90deg, #2dd4bf 0%, #84cc16 20%, #facc15 45%, #fb923c 70%, #ef4444 100%)' }} />
                    <input
                      className="dual-range dual-range-min"
                      type="range"
                      min={0}
                      max={1}
                      step={0.001}
                      value={minFloat}
                      onChange={(e) => updateMinFloat(e.target.value)}
                      style={{ position: 'absolute', left: 0, right: 0, top: 8, width: '100%' }}
                    />
                    <input
                      className="dual-range dual-range-max"
                      type="range"
                      min={0}
                      max={1}
                      step={0.001}
                      value={maxFloat}
                      onChange={(e) => updateMaxFloat(e.target.value)}
                      style={{ position: 'absolute', left: 0, right: 0, top: 8, width: '100%' }}
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <label style={{ display: 'grid', gap: 4, fontSize: '0.82rem' }}>
                      <span>Min float</span>
                      <input
                        type="number"
                        min={0}
                        max={1}
                        step={0.001}
                        value={minFloat}
                        onChange={(e) => updateMinFloat(e.target.value)}
                        className="float-input"
                        style={{ width: '100%', textAlign: 'left' }}
                      />
                    </label>
                    <label style={{ display: 'grid', gap: 4, fontSize: '0.82rem' }}>
                      <span>Max float</span>
                      <input
                        type="number"
                        min={0}
                        max={1}
                        step={0.001}
                        value={maxFloat}
                        onChange={(e) => updateMaxFloat(e.target.value)}
                        className="float-input"
                        style={{ width: '100%', textAlign: 'left' }}
                      />
                    </label>
                  </div>
                </div>
              </section>

              <section>
                <div style={{ fontWeight: 600, marginBottom: 8 }}>Source</div>
                <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', justifyContent: 'center' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      className="filter-checkbox"
                      checked={onlyCaseSkins}
                      onChange={(e) => setOnlyCaseSkins(e.target.checked)}
                    />
                    <span>Case skin</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      className="filter-checkbox"
                      checked={onlyCollectionSkins}
                      onChange={(e) => setOnlyCollectionSkins(e.target.checked)}
                    />
                    <span>Collection skin</span>
                  </label>
                </div>
              </section>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <button
                  type="button"
                  onClick={resetFilters}
                  style={{
                    background:'transparent',
                    color:'var(--text-color)',
                    border:'1px solid var(--surface-border)',
                    borderRadius:8,
                    padding:'7px 10px',
                    cursor:'pointer'
                  }}
                >
                  Reset
                </button>
                <button
                  type="button"
                  onClick={() => setShowFilters(false)}
                  style={{
                    background:'var(--button-bg)',
                    color:'var(--button-text)',
                    border:'1px solid var(--surface-border)',
                    borderRadius:8,
                    padding:'7px 10px',
                    cursor:'pointer'
                  }}
                >
                  Apply
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {loading && <div className="loading">Loading weapons…</div>}
      {error && <div className="loading" style={{ color:'tomato' }}>{error}</div>}
      {!q ? (
        <div className="categories-grid search-page-grid">
          {canUseFilters && activeFilterCount > 0 && (
            <div
              key="All"
              className="category-card item-card"
              data-return-id="all"
              onClick={() => {
                saveReturnTarget(categoryReturnScope, 'all');
                setQuery('');
                navigate('?q=all');
              }}
              style={{ cursor: 'pointer' }}
            >
              <div
                aria-hidden="true"
                style={{
                  width: 68,
                  height: 68,
                  borderRadius: 999,
                  margin: '0 auto 10px auto',
                  border: '1px solid var(--surface-border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '2rem',
                  fontWeight: 700,
                  color: 'var(--text-color)',
                  background: 'radial-gradient(circle at 35% 30%, rgba(255,255,255,0.2), rgba(255,255,255,0.05))'
                }}
              >
                ?
              </div>
              <div style={{ marginBottom:8, textAlign:'center', fontWeight:'bold' }}>
                <div className="category-label" style={{ fontSize:'1.1rem' }}>All</div>
              </div>
            </div>
          )}
          {WEAPON_CATEGORIES.map(cat => (
            <div
              key={cat.name}
              className="category-card item-card"
              data-return-id={cat.name}
              onClick={() => {
                saveReturnTarget(categoryReturnScope, cat.name);
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
        <div className="categories-grid search-page-grid">
          {sortedItems.map(it => (
            <Link
              key={it.slug}
              className="category-card item-card"
              to={{
                pathname: `/skin/${it.slug}`,
              }}
              state={{
                fromSearchHierarchy: {
                  section: 'weapons',
                  sectionLabel: 'Weapons',
                  type: activeWeaponType,
                },
              }}
              data-return-id={it.slug}
              onClick={() => saveReturnTarget(itemReturnScope, it.slug)}
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
            </Link>
          ))}
          {(!loading && sortedItems.length === 0) && (
            <div style={{ textAlign: 'center', width: '100%', color: '#6b7280' }}>No weapons found.</div>
          )}
        </div>
      )}
    </div>
  );
}
