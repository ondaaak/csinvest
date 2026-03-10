import React, { useEffect, useState, useMemo } from 'react';
import axios from 'axios';
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

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

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await axios.get(`${BASE_URL}/items/${slug}`);
        if (res.data.item) {
            setItem(res.data.item);
            setCases(res.data.cases || []);
            setCollection(res.data.collection || null);
        } else {
            setItem(res.data);
            setCases([]);
            setCollection(null);
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
        <a
          href={item.inspect ? `steam://rungame/730/76561202255233023/+csgo_econ_action_preview%${item.inspect}` : '#'}
          className="badge"
          style={{
            textDecoration: 'none',
            background: 'var(--button-bg)',
            color: 'var(--button-text)',
            border: '1px solid var(--border-color)',
            cursor: 'pointer',
            opacity: item.inspect ? 1 : 0.5,
            pointerEvents: item.inspect ? 'auto' : 'none'
          }}
        >
          Inspect in-game
        </a>
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
            </div>
        </div>
      </div>

    </div>
  );
}

export default SkinDetailPage;
