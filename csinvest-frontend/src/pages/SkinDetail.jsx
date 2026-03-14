import React, { useEffect, useState, useMemo, useRef } from 'react';
import axios from 'axios';
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { generateHex } from 'cs2-inspect-create';

const BASE_URL = '/api';

function SkinDetailPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [item, setItem] = useState(null);
  const [cases, setCases] = useState([]);
  const [collection, setCollection] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedFloat, setSelectedFloat] = useState(null);
  const [floatInput, setFloatInput] = useState('');
  const floatTrackRef = useRef(null);
  const isDraggingFloatRef = useRef(false);

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

  const collectionImgMap = useMemo(() => {
    const files = import.meta.glob('../assets/collections/*.{png,jpg,jpeg,webp,svg}', { eager: true, query: '?url', import: 'default' });
    const map = {};
    Object.entries(files).forEach(([path, url]) => {
      const filename = path.split('/').pop() || '';
      const base = filename.substring(0, filename.lastIndexOf('.'));
      map[base.toLowerCase()] = url;
    });
    return map;
  }, []);

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

  const charmImgMap = useMemo(() => {
    const files = import.meta.glob('../assets/charms/*.{png,jpg,jpeg,webp,svg}', { eager: true, query: '?url', import: 'default' });
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

  const sortedCharmKeys = useMemo(() => {
    return Object.keys(charmImgMap).sort((a, b) => b.length - a.length);
  }, [charmImgMap]);

  const sortedCaseKeys = useMemo(() => {
    return Object.keys(caseImgMap).sort((a, b) => b.length - a.length);
  }, [caseImgMap]);

  const sortedAgentKeys = useMemo(() => {
    return Object.keys(agentImgMap).sort((a, b) => b.length - a.length);
  }, [agentImgMap]);

  const clampToRange = (value, min, max) => {
    if (!Number.isFinite(value)) return min;
    return Math.min(max, Math.max(min, value));
  };

  const formatFloatInput = (value) => Number(value).toFixed(9).replace('.', ',');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await axios.get(`${BASE_URL}/items/${slug}`);
        if (res.data.item) {
          const loadedItem = res.data.item;
          setItem(loadedItem);
            setCases(res.data.cases || []);
            setCollection(res.data.collection || null);
          const initialMinFloat = Number(loadedItem?.min_float);
          const nextFloat = Number.isFinite(initialMinFloat) ? Math.max(0, Math.min(1, initialMinFloat)) : 0;
          setSelectedFloat(nextFloat);
          setFloatInput(formatFloatInput(nextFloat));
        } else {
          const loadedItem = res.data;
          setItem(loadedItem);
            setCases([]);
            setCollection(null);
          const initialMinFloat = Number(loadedItem?.min_float);
          const nextFloat = Number.isFinite(initialMinFloat) ? Math.max(0, Math.min(1, initialMinFloat)) : 0;
          setSelectedFloat(nextFloat);
          setFloatInput(formatFloatInput(nextFloat));
        }

        try {
            const histRes = await axios.get(`${BASE_URL}/items/${slug}/history`);
            setHistory(histRes.data.history || []);
        } catch (err) {
            console.error("Failed to load history", err);
        }

      } catch (e) {
        console.error(e);
        setError('Skin not found');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [slug]);

  if (loading) return <div className="dashboard-container"><div className="loading">Loading…</div></div>;
  if (error) return <div className="dashboard-container"><div className="loading">{error}</div></div>;
  if (!item) return null;

  const normalizeInspectHex = (raw) => {
    if (!raw || typeof raw !== 'string') return null;
    const trimmed = raw.trim();
    const previewMatch = trimmed.match(/csgo_econ_action_preview(?:%20|\s+)([0-9a-f]+)/i);
    const candidate = previewMatch ? previewMatch[1] : trimmed;
    const withoutPrefix = candidate
      .replace(/^csgo_econ_action_preview\s*%?/i, '')
      .replace(/^0x/i, '')
      .replace(/\s+/g, '');
    const hex = withoutPrefix.replace(/[^0-9a-f]/gi, '');
    if (!hex || hex.length % 2 !== 0) return null;
    return hex.toUpperCase();
  };

  const hexToBytes = (hex) => {
    const out = [];
    for (let i = 0; i < hex.length; i += 2) {
      out.push(parseInt(hex.slice(i, i + 2), 16));
    }
    return out;
  };

  const decodeVarint = (bytes, startIndex) => {
    let value = 0;
    let shift = 0;
    let index = startIndex;
    while (index < bytes.length && shift <= 63) {
      const byte = bytes[index];
      value += (byte & 0x7f) * Math.pow(2, shift);
      index += 1;
      if ((byte & 0x80) === 0) {
        return { value, nextIndex: index };
      }
      shift += 7;
    }
    return null;
  };

  const extractInspectFields = (rawInspect) => {
    const hex = normalizeInspectHex(rawInspect);
    if (!hex || hex.length < 10) return null;

    const fullBytes = hexToBytes(hex);
    if (fullBytes.length <= 5) return null;

    const payload = fullBytes.slice(0, -4);
    const bytes = payload[0] === 0x00 ? payload.slice(1) : payload;

    const extracted = {
      defIndex: null,
      paintIndex: null,
      rarityIndex: null,
      paintSeed: null,
      quality: null,
    };

    let index = 0;
    while (index < bytes.length) {
      const keyInfo = decodeVarint(bytes, index);
      if (!keyInfo) return null;
      const key = keyInfo.value;
      const fieldNumber = key >>> 3;
      const wireType = key & 0x07;
      index = keyInfo.nextIndex;

      if (wireType === 0) {
        const valueInfo = decodeVarint(bytes, index);
        if (!valueInfo) return null;
        const value = valueInfo.value;
        index = valueInfo.nextIndex;

        if (fieldNumber === 3) extracted.defIndex = value;
        if (fieldNumber === 4) extracted.paintIndex = value;
        if (fieldNumber === 5) extracted.rarityIndex = value;
        if (fieldNumber === 8) extracted.paintSeed = value;
        if (fieldNumber === 9) extracted.quality = value;
        continue;
      }

      if (wireType === 1) {
        index += 8;
        continue;
      }

      if (wireType === 2) {
        const lengthInfo = decodeVarint(bytes, index);
        if (!lengthInfo) return null;
        index = lengthInfo.nextIndex + lengthInfo.value;
        continue;
      }

      if (wireType === 5) {
        index += 4;
        continue;
      }

      return null;
    }

    if (![extracted.defIndex, extracted.paintIndex, extracted.rarityIndex, extracted.paintSeed].every(Number.isFinite)) {
      return null;
    }

    return extracted;
  };

  const buildInspectFromFields = ({ defIndex, paintIndex, rarityIndex, paintSeed, quality }, floatValue) => {
    const d = Number(defIndex);
    const p = Number(paintIndex);
    const r = Number(rarityIndex);
    const s = Number(paintSeed);
    const q = Number(quality);
    if (![d, p, r, s].every(Number.isFinite)) {
      return null;
    }

    try {
      const payload = {
        defindex: d >>> 0,
        paintindex: p >>> 0,
        rarity: r >>> 0,
        paintseed: s >>> 0,
        paintwear: floatValue,
      };
      if (Number.isFinite(q) && q > 0) {
        payload.quality = q >>> 0;
      }
      return String(generateHex(payload)).toUpperCase();
    } catch {
      return null;
    }
  };

  const getSkinImage = (itemSlug, itemName) => {
    if (!itemSlug) return null;
    const s = itemSlug.toLowerCase();
    
    if (agentImgMap[s]) return agentImgMap[s];
    if (skinImgMap[s]) return skinImgMap[s];
    if (charmImgMap[s]) return charmImgMap[s];
    
    const charmMatch = sortedCharmKeys.find(key => s.startsWith(key));
    if (charmMatch) return charmImgMap[charmMatch];

    const agentMatch = sortedAgentKeys.find(key => s.startsWith(key));
    if (agentMatch) return agentImgMap[agentMatch];

    const match = sortedKeys.find(key => s.startsWith(key));
    if (match) return skinImgMap[match];


    if (itemName) {
      const base = itemName.toLowerCase()
        .replace(/[|]+/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");
      if (agentImgMap[base]) return agentImgMap[base];
      if (skinImgMap[base]) return skinImgMap[base];
    }
    return null;
  };

  const getCaseImage = (caseSlug) => {
      if (!caseSlug) return null;
      const s = caseSlug.toLowerCase();
      if (caseImgMap[s]) return caseImgMap[s];
      
      const match = sortedCaseKeys.find(key => s.startsWith(key));
      if (match) return caseImgMap[match];
      return null;
  }

  const getCollectionImage = (slug) => {
    if (!slug) return null;
    if (collectionImgMap[slug]) return collectionImgMap[slug];
    const k = Object.keys(collectionImgMap).find(key => slug.startsWith(key));
    return k ? collectionImgMap[k] : null;
  };

  const img = getSkinImage(item.slug, item.name);
  const supportsFloat = ['skin', 'knife', 'glove'].includes((item.item_type || '').toLowerCase());
  const parsedMinFloat = Number(item.min_float);
  const parsedMaxFloat = Number(item.max_float);
  const minFloat = Number.isFinite(parsedMinFloat) ? Math.max(0, Math.min(1, parsedMinFloat)) : 0;
  const maxFloat = Number.isFinite(parsedMaxFloat) ? Math.max(0, Math.min(1, parsedMaxFloat)) : 1;
  const normalizedMinFloat = Math.min(minFloat, maxFloat);
  const normalizedMaxFloat = Math.max(minFloat, maxFloat);
  const minFloatPercent = normalizedMinFloat * 100;
  const maxFloatPercent = normalizedMaxFloat * 100;
  const effectiveSelectedFloat = clampToRange(
    selectedFloat ?? normalizedMinFloat,
    normalizedMinFloat,
    normalizedMaxFloat
  );
  const selectedFloatPercent = effectiveSelectedFloat * 100;
  const parsedInspectFields = extractInspectFields(item.inspect);
  const generatedInspect = buildInspectFromFields(
    {
      defIndex: parsedInspectFields?.defIndex ?? item.def_index,
      paintIndex: parsedInspectFields?.paintIndex ?? item.paint_index,
      rarityIndex: parsedInspectFields?.rarityIndex ?? item.rarity_index,
      paintSeed: parsedInspectFields?.paintSeed ?? item.paint_seed,
      quality: parsedInspectFields?.quality ?? item.quality,
    },
    effectiveSelectedFloat
  );
  // Fallback for AWP Redline: use original inspect if generated fails or slug matches
  let useFallbackInspect = false;
  if (
    slug === 'awp-redline' &&
    (!generatedInspect || generatedInspect.length < 10)
  ) {
    useFallbackInspect = true;
  }
  const canInspect = Boolean(!useFallbackInspect && generatedInspect || item.inspect);
  const inspectToken = String(
    useFallbackInspect ? item.inspect : (generatedInspect || item.inspect || '')
  )
    .replace(/^csgo_econ_action_preview\s*/i, '')
    .replace(/^%20/, '')
    .trim();
  const inspectHref =
    `steam://rungame/730/76561202255233023/+csgo_econ_action_preview%20${inspectToken}`;

  const setFloatFromPointerX = (clientX) => {
    const el = floatTrackRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (!rect.width) return;
    const rawPercent = ((clientX - rect.left) / rect.width) * 100;
    const normalizedPercent = Math.max(0, Math.min(100, rawPercent));
    const next = normalizedPercent / 100;
    const clamped = clampToRange(next, normalizedMinFloat, normalizedMaxFloat);
    setSelectedFloat(clamped);
    setFloatInput(formatFloatInput(clamped));
  };

  const onFloatTrackMouseDown = (e) => {
    isDraggingFloatRef.current = true;
    setFloatFromPointerX(e.clientX);
  };

  const onFloatTrackMouseMove = (e) => {
    if (!isDraggingFloatRef.current) return;
    if ((e.buttons & 1) !== 1) {
      isDraggingFloatRef.current = false;
      return;
    }
    setFloatFromPointerX(e.clientX);
  };

  const onFloatTrackMouseUp = () => {
    isDraggingFloatRef.current = false;
  };

  const onFloatInputChange = (nextRaw) => {
    const withComma = nextRaw.replace('.', ',');
    if (!/^\d*(,\d{0,9})?$/.test(withComma)) {
      return;
    }
    setFloatInput(withComma);
    const normalized = withComma.replace(',', '.');
    const parsed = Number(normalized);
    if (Number.isFinite(parsed)) {
      setSelectedFloat(clampToRange(parsed, normalizedMinFloat, normalizedMaxFloat));
    }
  };

  const onFloatInputBlur = () => {
    setFloatInput(formatFloatInput(effectiveSelectedFloat));
  };

  const rarityClass = (rarity) => {
    switch ((rarity || '').toLowerCase()) {
      case 'consumer grade':
      case 'consumer':
        return 'consumer';
      case 'industrial grade':
      case 'industrial':
        return 'industrial';
      case 'milspec grade':
      case 'milspec':
      case 'mil-spec':
      case 'mil spec':
        return 'milspec';
      case 'restricted':
        return 'restricted';
      case 'classified':
        return 'classified';
      case 'covert':
        return 'covert';
      case 'contraband':
        return 'contraband';
      case 'knife/glove':
      case 'knife':
      case 'glove':
        return 'contraband';
      case 'distinguished':
        return 'milspec'; 
      case 'exceptional':
        return 'restricted';
      case 'superior':
        return 'classified';
      case 'master':
        return 'covert';
      default:
        return '';
    }
  };

  const navCtx = location.state?.fromSearchHierarchy || null;
  const sectionPath = navCtx?.section ? `/search/${navCtx.section}` : null;
  const typePath = navCtx?.type && sectionPath
    ? `${sectionPath}?q=${encodeURIComponent(`${navCtx.type} | `)}`
    : null;
  const skinOnlyName = (() => {
    const raw = item?.name || '';
    if (!raw.includes('|')) return raw;
    return raw.split('|').slice(1).join('|').trim();
  })();

  return (
    <div className="dashboard-container skin-detail-page">
      <div className="skin-detail-topbar" style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
        <button onClick={() => navigate(-1)} aria-label="Back" style={{
          background:'var(--button-bg)', color:'var(--button-text)', border:'1px solid var(--border-color)', borderRadius:10, padding:'6px 10px', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', lineHeight:1
        }}>←</button>
        <div className="skin-detail-breadcrumb" style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: '0.95rem' }}>
          {sectionPath && navCtx?.sectionLabel && (
            <>
              <button
                type="button"
                onClick={() => navigate(sectionPath)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-color)', cursor: 'pointer', padding: 0, fontSize: '0.95rem' }}
              >
                {navCtx.sectionLabel}
              </button>
              {typePath && navCtx?.type && (
                <>
                  <span style={{ opacity: 0.7 }}>|</span>
                  <button
                    type="button"
                    onClick={() => navigate(typePath)}
                    style={{ background: 'transparent', border: 'none', color: 'var(--text-color)', cursor: 'pointer', padding: 0, fontSize: '0.95rem' }}
                  >
                    {navCtx.type}
                  </button>
                </>
              )}
            </>
          )}
          <span style={{ opacity: 0.7 }}>|</span>
          <span style={{ fontSize: '0.95rem', opacity: 0.9 }} title={skinOnlyName || item.name}>
            {skinOnlyName || item.name}
          </span>
        </div>
        <button
          type="button"
          onClick={() => navigate('/search')}
          aria-label="Go to Search"
          title="Search"
          style={{
            background: 'var(--button-bg)',
            color: 'var(--button-text)',
            border: '1px solid var(--border-color)',
            borderRadius: 10,
            width: 34,
            height: 34,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            lineHeight: 1,
            flexShrink: 0,
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M3 10.5L12 3l9 7.5" />
            <path d="M5 9.5V21h14V9.5" />
          </svg>
        </button>
      </div>

      <div className="skin-detail-title-row" style={{ display:'flex', alignItems:'center', gap:12, flexWrap:'wrap', marginBottom:8 }}>
        <h2 style={{ margin:0, flex:1 }}>{item.name}</h2>
      </div>

      <div className="skin-detail-actions" style={{ display:'flex', alignItems:'center', justifyContent:'flex-end', gap:8, marginBottom: 16 }}>
        <span className={`badge ${rarityClass(item.rarity)}`}>{item.rarity || '—'}</span>
      </div>
      
      <div className="stat-card skin-detail-card" style={{ background:'var(--surface-bg)', color:'var(--text-color)', marginBottom: 20 }}>
        <div className="skin-detail-main" style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
            {img && (
            <img className="skin-detail-image" src={img} alt={item.name} style={{ width:200, height:200, objectFit:'contain', borderRadius:12 }} />
            )}
            <div className="skin-detail-info" style={{ flex: 1, minWidth: 200, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
                {cases.length > 0 && (
                    <div style={{ marginTop: 0 }}>
                        <strong style={{ display: 'block', marginBottom: 10 }}>Found in cases:</strong>
                        <div style={{ display: 'flex', gap: 10, marginTop: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
                            {cases.map(c => {
                                const cImg = getCaseImage(c.slug || '');
                                return (
                                    <Link to={`/case/${c.slug}`} key={c.item_id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 80, textDecoration: 'none', color: 'inherit' }} title={c.name}>
                                        {cImg ? (
                                          <img src={cImg} alt={c.name} style={{ width: 60, height: 60, objectFit: 'contain', display: 'block', margin: '0 auto' }} />
                                        ) : (
                                            <div style={{ width: 60, height: 60, background: '#333', borderRadius: 8 }}></div>
                                        )}
                                        <div style={{ fontSize: '0.7rem', marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%' }}>{c.name}</div>
                                    </Link>
                                );
                            })}
                        </div>
                    </div>
                )}

                {collection && (
                    <div style={{ marginTop: cases.length > 0 ? 20 : 0 }}>
                        <strong style={{ display: 'block', marginBottom: 10 }}>Found in collection:</strong>
                        <div style={{ marginTop: 10, display: 'flex', justifyContent: 'center' }}>
                            <Link to={`/collection/${collection.slug}`} style={{ display: 'inline-block', textAlign: 'center', width: 80, textDecoration: 'none', color: 'inherit' }} title={collection.name}>
                                {getCollectionImage(collection.slug || '') ? (
                                  <img src={getCollectionImage(collection.slug || '')} alt={collection.name} style={{ width: 60, height: 60, objectFit: 'contain', display: 'block', margin: '0 auto' }} />
                                ) : (
                                    <div style={{ width: 60, height: 60, background: '#333', borderRadius: 8, margin: '0 auto' }}></div>
                                )}
                                <div style={{ fontSize: '0.7rem', marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{collection.name}</div>
                            </Link>
                        </div>
                    </div>
                )}

                {supportsFloat && (
                  <div className="skin-float-range" style={{ marginTop: (cases.length > 0 || collection) ? 20 : 0 }}>
                    <strong style={{ display: 'block', marginBottom: 10 }}>Float range:</strong>
                    <div
                      className="float-range-track-wrap"
                      ref={floatTrackRef}
                      onMouseDown={onFloatTrackMouseDown}
                      onMouseMove={onFloatTrackMouseMove}
                      onMouseUp={onFloatTrackMouseUp}
                      onMouseLeave={onFloatTrackMouseUp}
                    >
                      <div className="float-range-track" aria-hidden="true" />
                      <div className="float-range-mask" style={{ left: '0%', width: `${minFloatPercent}%` }} aria-hidden="true" />
                      <div className="float-range-mask" style={{ left: `${maxFloatPercent}%`, width: `${Math.max(100 - maxFloatPercent, 0)}%` }} aria-hidden="true" />
                      <div className="float-range-cap" style={{ left: `${minFloatPercent}%`, width: `${Math.max(maxFloatPercent - minFloatPercent, 1)}%` }} aria-hidden="true" />
                      <div className="float-range-pin float-range-pin-min" style={{ left: `${minFloatPercent}%` }}>
                        <span className="float-range-pin-label">MIN {normalizedMinFloat.toFixed(2)}</span>
                      </div>
                      <div className="float-range-pin float-range-pin-max" style={{ left: `${maxFloatPercent}%` }}>
                        <span className="float-range-pin-label">MAX {normalizedMaxFloat.toFixed(2)}</span>
                      </div>
                      <div className="float-range-pin float-range-pin-current" style={{ left: `${selectedFloatPercent}%` }}>
                        <span className="float-range-current-dot" />
                      </div>
                    </div>
                    <div className="float-range-tiers" aria-hidden="true">
                      <span>FN</span>
                      <span>MW</span>
                      <span>FT</span>
                      <span>WW</span>
                      <span>BS</span>
                    </div>
                    <div className="float-inspect-controls">
                      <input
                        type="text"
                        inputMode="decimal"
                        className="float-input"
                        value={floatInput}
                        onChange={(e) => onFloatInputChange(e.target.value)}
                        onBlur={onFloatInputBlur}
                        aria-label="Float value"
                      />
                      <a
                        href={inspectHref}
                        className="account-button header-bordered-button"
                        style={{
                          textDecoration: 'none',
                          cursor: 'pointer',
                          opacity: canInspect ? 1 : 0.5,
                          pointerEvents: canInspect ? 'auto' : 'none'
                        }}
                      >
                        Inspect in-game
                      </a>
                    </div>
                  </div>
                )}
            </div>
        </div>
      </div>

    </div>
  );
}

export default SkinDetailPage;
