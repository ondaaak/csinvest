import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useParams, useNavigate } from 'react-router-dom';
import { useCurrency } from '../currency/CurrencyContext.jsx';

const BASE_URL = 'http://127.0.0.1:8000';

function CollectionDetailPage() {
  const { slug } = useParams();
  const { formatPrice } = useCurrency();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

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

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await axios.get(`${BASE_URL}/collections/${slug}`);
        setData(res.data);
      } catch (e) {
        console.error(e);
        setError('Collection not found');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [slug]);

  if (loading) return <div className="dashboard-container"><div className="loading">Loading…</div></div>;
  if (error) return <div className="dashboard-container"><div className="loading">{error}</div></div>;
  if (!data) return null;

  const { collection: coll, skins = [] } = data;

  const getSkinImage = (slug) => {
    if (!slug) return null;
    if (skinImgMap[slug]) return skinImgMap[slug];
    const match = sortedKeys.find(k => slug.startsWith(k));
    return match ? skinImgMap[match] : null;
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

  const getCollectionImage = (slug) => {
    if (!slug) return null;
    if (collectionImgMap[slug]) return collectionImgMap[slug];
    const k = Object.keys(collectionImgMap).find(key => slug.startsWith(key));
    return k ? collectionImgMap[k] : null;
  };

  return (
    <div className="dashboard-container">
      <div style={{ display:'flex', gap:12, alignItems:'center', marginBottom:20 }}>
        <button onClick={() => navigate(-1)} aria-label="Back" style={{
          background:'var(--button-bg)', color:'var(--button-text)', border:'1px solid var(--border-color)', borderRadius:10, padding:'6px 10px', cursor:'pointer'
        }}>←</button>
        <h2 style={{ margin:0 }}>{coll.name}</h2>
        <div style={{ flex:1 }}></div>
      </div>

      <div style={{ display:'flex', gap:24, alignItems:'flex-start', marginBottom:32 }}>
        <div style={{ width:200, flexShrink:0, textAlign:'center' }}>
          {getCollectionImage(coll.slug) ? (
            <img src={getCollectionImage(coll.slug)} alt={coll.name} style={{ width:'100%', borderRadius:12, border:'1px solid var(--surface-border)' }} />
          ) : (
            <div style={{ width:'100%', aspectRatio:'1', background:'var(--surface-bg)', borderRadius:12, border:'1px solid var(--surface-border)', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <span style={{ fontSize:'2rem', opacity:0.3 }}>📦</span>
            </div>
          )}
        </div>
        <div style={{ flex:1 }}>
          <div style={{ background:'var(--card-bg)', borderRadius:12, padding:20, border:'1px solid var(--surface-border)' }}>
            <h3 style={{ marginTop:0 }}>Collection Info</h3>
            <div style={{ display:'grid', gridTemplateColumns:'auto 1fr', gap:'8px 16px', fontSize:'0.9rem' }}>
              <div style={{ opacity:0.6 }}>Type:</div>
              <div>Collection</div>
              {coll.drop_type && (
                <>
                  <div style={{ opacity:0.6 }}>Status:</div>
                  <div>
                    <span style={{
                      background: badgeColors(coll.drop_type).bg,
                      color: badgeColors(coll.drop_type).color,
                      padding:'2px 6px', borderRadius:4, fontWeight:600, fontSize:'0.8rem', textTransform:'uppercase'
                    }}>
                      {coll.drop_type.replace('-', ' ')}
                    </span>
                  </div>
                </>
              )}
              <div style={{ opacity:0.6 }}>Items:</div>
              <div>{skins.length}</div>
            </div>
          </div>
        </div>
      </div>

      {skins.length > 0 && (
        <>
          <h3 style={{ borderBottom:'1px solid var(--surface-border)', paddingBottom:8, marginBottom:16 }}>Skins</h3>
          <div className="categories-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))' }}>
            {skins.map(it => (
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
                  <div className="category-label" style={{ fontSize:'0.9rem' }}>{it.name}</div>
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
                <div style={{ fontSize:'0.85rem', fontWeight:600 }}>
                  {it.current_price ? formatPrice(it.current_price) : '—'}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default CollectionDetailPage;
