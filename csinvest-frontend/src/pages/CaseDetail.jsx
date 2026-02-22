import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useParams, useNavigate } from 'react-router-dom';
import { useCurrency } from '../currency/CurrencyContext.jsx';
import csfloatLogo from '../assets/site/csfloat.png';
import haloskinsLogo from '../assets/site/haloskins.png';

const BASE_URL = 'http://127.0.0.1:8000';

function CaseDetailPage() {
  const { slug } = useParams();
  const { formatPrice } = useCurrency();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

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
        const res = await axios.get(`${BASE_URL}/cases/${slug}`);
        setData(res.data);
      } catch (e) {
        console.error(e);
        setError('Case not found');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [slug]);

  if (loading) return <div className="dashboard-container"><div className="loading">Loading…</div></div>;
  if (error) return <div className="dashboard-container"><div className="loading">{error}</div></div>;
  if (!data) return null;

  const { case: cs, skins = [], knives = [], gloves = [] } = data;

  const rawSkinItems = Array.isArray(skins) ? skins : [];
  
  // Helper to identify knives/gloves if not separated in API
  const knifeLike = (item) => {
    const r = (item.rarity || '').toLowerCase();
    return r === 'knife' || r === 'knife/glove';
  };
  const gloveLike = (item) => {
    const r = (item.rarity || '').toLowerCase();
    return r === 'glove' || r === 'knife/glove';
  };

  const skinItems = rawSkinItems.filter(s => !knifeLike(s) && !gloveLike(s));
  const knifeItems = [...knives, ...rawSkinItems.filter(knifeLike)].filter((v,i,a)=>a.findIndex(x=>x.item_id===v.item_id)===i);
  const gloveItems = [...gloves, ...rawSkinItems.filter(gloveLike)].filter((v,i,a)=>a.findIndex(x=>x.item_id===v.item_id)===i);

  const getSkinImage = (itemSlug, itemName) => {
    if (!itemSlug) return null;
    const s = itemSlug.toLowerCase();
    if (skinImgMap[s]) return skinImgMap[s];
    
    const match = sortedKeys.find(key => s.startsWith(key));
    if (match) return skinImgMap[match];

    if (itemName) {
      const base = itemName.toLowerCase()
        .replace(/[|]+/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");
      if (skinImgMap[base]) return skinImgMap[base];
    }
    return null;
  };

  const badgeColors = (dt) => {
    switch ((dt || '').toLowerCase()) {
      case 'active':
        return { bg:'rgba(34,197,94,0.18)', color:'var(--profit-color)', label:'Active' };
      case 'rare':
        return { bg:'rgba(234,179,8,0.25)', color:'#fbbf24', label:'Rare' };
      case 'discontinued':
        return { bg:'rgba(239,68,68,0.18)', color:'var(--loss-color)', label:'Discontinued' };
      default:
        return { bg:'rgba(107,114,128,0.25)', color:'var(--text-color)', label: dt || 'Unknown' };
    }
  };

  const getRarityColor = (rarity) => {
    if (!rarity) return { bg: 'rgba(107,114,128,0.25)', color: 'var(--text-color)' };
    const r = rarity.toLowerCase();
    if (r.includes('contraband') || r.includes('knife') || r.includes('glove')) return { bg: 'rgba(228, 174, 57, 0.25)', color: '#e4ae39' };
    if (r.includes('covert') || r.includes('extraordinary')) return { bg: 'rgba(235, 75, 75, 0.25)', color: '#eb4b4b' };
    if (r.includes('classified')) return { bg: 'rgba(211, 44, 230, 0.25)', color: '#d32ce6' };
    if (r.includes('restricted')) return { bg: 'rgba(136, 71, 255, 0.25)', color: '#8847ff' };
    if (r.includes('mil-spec') || r.includes('milspec')) return { bg: 'rgba(75, 105, 255, 0.25)', color: '#4b69ff' };
    if (r.includes('industrial')) return { bg: 'rgba(94, 152, 217, 0.25)', color: '#5e98d9' };
    if (r.includes('consumer')) return { bg: 'rgba(176, 195, 217, 0.25)', color: '#b0c3d9' };
    return { bg: 'rgba(107,114,128,0.25)', color: 'var(--text-color)' };
  };

  const statusBadge = badgeColors(cs.drop_type);

  // Render a simpler card for each item type
  const renderItemGrid = (items) => {
    if (!items || items.length === 0) return null;
    return (
      <div className="categories-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))' }}>
        {items.map(it => {
          const rarityStyle = getRarityColor(it.rarity);
          return (
            <div
              key={it.item_id || it.slug}
              className="category-card item-card"
              onClick={() => navigate(`/skin/${it.slug}`)}
              style={{ cursor: 'pointer', padding: 12 }}
            >
              {getSkinImage(it.slug, it.name) ? (
                <img src={getSkinImage(it.slug, it.name)} alt={it.name} className="category-img" style={{ width: '100%', height: 'auto', maxHeight: 100, objectFit: 'contain' }} />
              ) : (
                <div className="category-icon" aria-hidden="true" style={{ width: '100%', height: 100 }}></div>
              )}
              <div style={{ marginTop: 8 }}>
                <div className="category-label" style={{ fontSize:'0.9rem', marginBottom: 4 }}>{it.name}</div>
                {it.rarity && (
                  <span style={{
                    display:'inline-block',
                    fontSize:'0.65rem',
                    padding:'3px 6px',
                    borderRadius:6,
                    background: rarityStyle.bg,
                    color: rarityStyle.color,
                    fontWeight:600
                  }}>
                    {it.rarity.toUpperCase()}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="dashboard-container">
      {/* Header */}
      <div style={{ display:'flex', gap:12, alignItems:'center', marginBottom:20 }}>
        <button onClick={() => navigate(-1)} aria-label="Back" style={{
          background:'var(--button-bg)', color:'var(--button-text)', border:'1px solid var(--border-color)', borderRadius:10, padding:'6px 10px', cursor:'pointer'
        }}>←</button>
        <h2 style={{ margin:0 }}>{cs.name}</h2>
        <div style={{ flex:1 }}></div>
      </div>

      {/* Main Info Section */}
      <div style={{ display:'flex', gap:24, alignItems:'flex-start', marginBottom:32, flexWrap: 'wrap' }}>
        {/* Left: Image */}
        <div style={{ width:200, flexShrink:0, textAlign:'center' }}>
          {caseImgMap[slug] ? (
            <img src={caseImgMap[slug]} alt={cs.name} style={{ width:'100%', borderRadius:12, border:'1px solid var(--surface-border)', padding: 12, background: 'var(--surface-bg)' }} />
          ) : (
            <div style={{ width:'100%', aspectRatio:'1', background:'var(--surface-bg)', borderRadius:12, border:'1px solid var(--surface-border)', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <span style={{ fontSize:'2rem', opacity:0.3 }}>📦</span>
            </div>
          )}
        </div>

        {/* Right: Info Card */}
        <div style={{ flex:1, minWidth: 280 }}>
          <div style={{ background:'var(--card-bg)', borderRadius:12, padding:20, border:'1px solid var(--surface-border)' }}>
            <h3 style={{ marginTop:0 }}>Case Info</h3>
            <div style={{ display:'grid', gridTemplateColumns:'auto 1fr', gap:'8px 16px', fontSize:'0.9rem', alignItems: 'center' }}>
              
              <div style={{ opacity:0.6 }}>Type:</div>
              <div>Case</div>

              {cs.drop_type && (
                <>
                  <div style={{ opacity:0.6 }}>Status:</div>
                  <div>
                    <span style={{
                      background: statusBadge.bg,
                      color: statusBadge.color,
                      padding:'2px 6px', borderRadius:4, fontWeight:600, fontSize:'0.8rem', textTransform:'uppercase'
                    }}>
                      {statusBadge.label}
                    </span>
                  </div>
                </>
              )}

              <div style={{ opacity:0.6 }}>Current Price:</div>
              <div style={{ fontWeight: 600 }}>{formatPrice(cs.current_price)}</div>

              <div style={{ opacity:0.6 }}>Items:</div>
              <div>{skinItems.length + knifeItems.length + gloveItems.length}</div>
              
              {/* Buy Links Row */}
              <div style={{ opacity:0.6 }}>Market:</div>
              <div style={{ display:'flex', gap:8, alignItems:'center', justifyContent: 'center' }}>
                <a href={`https://csfloat.com/?query=${encodeURIComponent(cs.name)}`} target="_blank" rel="noreferrer" title="CSFloat" style={{
                    width:28, height:28, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center',
                    background:'rgba(84, 84, 99, 0.27)', color:'var(--text-color)', border:'1px solid var(--surface-border)', textDecoration:'none', overflow: 'hidden'
                  }}>
                    <img src={csfloatLogo} alt="CSFloat" style={{ width:16, height:16, objectFit:'contain', display: 'block' }} />
                </a>
                <a href={`https://haloskins.com/search?q=${encodeURIComponent(cs.name)}`} target="_blank" rel="noreferrer" title="HaloSkins" style={{
                    width:28, height:28, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center',
                    background:'rgba(34,197,94,0.2)', color:'var(--text-color)', border:'1px solid var(--surface-border)', textDecoration:'none', overflow: 'hidden'
                  }}>
                    <img src={haloskinsLogo} alt="HaloSkins" style={{ width:16, height:16, objectFit:'contain', display: 'block' }} />
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Sections */}
      {skinItems.length > 0 && (
        <>
          <h3 style={{ borderBottom:'1px solid var(--surface-border)', paddingBottom:8, marginBottom:16 }}>Skins</h3>
          {renderItemGrid(skinItems)}
        </>
      )}

      {knifeItems.length > 0 && (
        <>
          <h3 style={{ borderBottom:'1px solid var(--surface-border)', paddingBottom:8, marginBottom:16, marginTop: 32 }}>Rare Special Items (Knives)</h3>
          {renderItemGrid(knifeItems)}
        </>
      )}

      {gloveItems.length > 0 && (
        <>
          <h3 style={{ borderBottom:'1px solid var(--surface-border)', paddingBottom:8, marginBottom:16, marginTop: 32 }}>Rare Special Items (Gloves)</h3>
          {renderItemGrid(gloveItems)}
        </>
      )}
    </div>
  );
}

export default CaseDetailPage;