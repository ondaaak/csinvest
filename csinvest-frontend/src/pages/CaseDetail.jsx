import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useParams, useNavigate } from 'react-router-dom';
import { useCurrency } from '../currency/CurrencyContext.jsx';

const BASE_URL = 'http://127.0.0.1:8000';

function CaseDetailPage() {
  const { slug } = useParams();
    const { formatPrice } = useCurrency();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
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

  const doRefresh = async () => {
    try {
      setRefreshing(true);
      await axios.post(`${BASE_URL}/refresh-items`, null, { params: { item_type: 'case' } });
      const res = await axios.get(`${BASE_URL}/cases/${slug}`);
      setData(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setRefreshing(false);
    }
  };

  if (loading) return <div className="dashboard-container"><div className="loading">Loading…</div></div>;
  if (error) return <div className="dashboard-container"><div className="loading">{error}</div></div>;
  if (!data) return null;

  const { case: cs, skins = [], knives = [], gloves = [] } = data;

  const rawSkinItems = Array.isArray(skins) ? skins : [];
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

  const knifePerItemOdds = (() => {
    const count = knifeItems.length || 1;
    return (0.26 / count).toFixed(4) + '%';
  })();
  const glovePerItemOdds = (() => {
    const count = gloveItems.length || 1;
    return (0.26 / count).toFixed(4) + '%';
  })();

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

  const badge = badgeColors(cs.drop_type);

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
      default:
        return '';
    }
  };

  const rarityOdds = (rarity) => {
    switch ((rarity || '').toLowerCase()) {
      case 'consumer grade':
      case 'consumer':
        return '—';
      case 'industrial grade':
      case 'industrial':
        return '—';
      case 'milspec grade':
      case 'milspec':
      case 'mil-spec':
      case 'mil spec':
        return 80.00;
      case 'restricted':
        return 15.97;
      case 'classified':
        return 3.20;
      case 'covert':
        return 0.64;
      default:
        return null;
    }
  };

  const rarityCounts = (() => {
    const counts = { milspec: 0, restricted: 0, classified: 0, covert: 0 };
    skinItems.forEach(s => {
      const r = (s.rarity || '').toLowerCase();
      if (r === 'milspec' || r === 'milspec grade' || r === 'mil-spec' || r === 'mil spec') counts.milspec += 1;
      else if (r === 'restricted') counts.restricted += 1;
      else if (r === 'classified') counts.classified += 1;
      else if (r === 'covert') counts.covert += 1;
    });
    return counts;
  })();

  const perItemOddsText = (rarity) => {
    const base = rarityOdds(rarity);
    if (base == null || base === '—') return '—';
    const r = (rarity || '').toLowerCase();
    let count = 1;
    if (r === 'milspec' || r === 'milspec grade' || r === 'mil-spec' || r === 'mil spec') count = rarityCounts.milspec || 1;
    else if (r === 'restricted') count = rarityCounts.restricted || 1;
    else if (r === 'classified') count = rarityCounts.classified || 1;
    else if (r === 'covert') count = rarityCounts.covert || 1;
    const perItem = base / count;
    return `${perItem.toFixed(2)}%`;
  };

  return (
    <div className="dashboard-container">
      <div style={{ display:'flex', alignItems:'center', gap:12, flexWrap:'wrap', marginBottom:12 }}>
        <button onClick={() => navigate(-1)} aria-label="Back" style={{
          background:'var(--button-bg)', color:'var(--button-text)', border:'1px solid var(--border-color)', borderRadius:10, padding:'6px 10px', cursor:'pointer'
        }}>←</button>
        <h2 style={{ margin:0, flex:1, paddingLeft:145 }}>{cs.name}</h2>
        <div style={{
          fontSize:'0.7rem', padding:'4px 8px', borderRadius:8, background:badge.bg, color:badge.color, fontWeight:600
        }}>{badge.label.toUpperCase()}</div>
        <button disabled style={{
          background:'var(--button-bg)', color:'var(--button-text)', border:'1px solid var(--border-color)', borderRadius:10, padding:'8px 12px', cursor: refreshing ? 'not-allowed':'pointer'
        }}>Refresh prices</button>
      </div>
      <div className="stat-card" style={{ background:'var(--surface-bg)', color:'var(--text-color)' }}>
        {caseImgMap[slug] && (
          <div style={{ width:140, height:140, display:'flex', alignItems:'center', justifyContent:'center', background:'var(--surface-bg)', border:'1px solid var(--surface-border)', borderRadius:16, margin:'0 auto 12px auto', padding:10 }}>
            <img src={caseImgMap[slug]} alt={cs.name} style={{ maxWidth:'100%', maxHeight:'100%', objectFit:'contain' }} />
          </div>
        )}
        <div style={{ display:'flex', gap:'12px', flexWrap:'wrap', fontSize:'0.85rem' }}>
          <div><strong>Release:</strong> {cs.release_date || '—'}</div>
          <div><strong>Status:</strong> {badge.label}</div>
          <div><strong>Current Price:</strong> {formatPrice(cs.current_price)}</div>
        </div>
      </div>

      <h3 style={{ marginTop:0 }}>Contained Skins</h3>
      <div className="stat-card" style={{ background:'var(--surface-bg)', color:'var(--text-color)', fontSize:'0.9rem' }}>
        <strong>Odds:</strong>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(180px, 1fr))', gap:8, marginTop:8 }}>
          <div><span className="badge milspec">Mil‑Spec</span> 1 / 1.25 → 80.00%</div>
          <div><span className="badge restricted">Restricted</span> 1 / 6.26 → 15.97%</div>
          <div><span className="badge classified">Classified</span> 1 / 31.28 → 3.20%</div>
          <div><span className="badge covert">Covert</span> 1 / 156.4 → 0.64%</div>
          <div><span className="badge contraband">Knives / Gloves</span> 1 / 391 → 0.26%</div>
        </div>
      </div>
      {skinItems.length === 0 && <div style={{ opacity:0.6, fontSize:'0.85rem' }}>No skins linked to this case yet.</div>}
      {skinItems.length > 0 && (
        <div className="categories-grid" style={{ gridTemplateColumns:'repeat(auto-fill, minmax(240px, 1fr))' }}>
          {skinItems.map(s => (
            <button
              key={s.item_id}
              className="category-card"
              style={{ padding: '22px 18px' }}
              onClick={() => navigate(`/skin/${s.slug}`)}
            >
              <div className="card-header">
                <div className="category-label" style={{ fontSize:'1.05rem', color:'var(--text-color)' }}>{s.name}</div>
                <div style={{ marginTop:6, display:'flex', alignItems:'center', gap:8 }}>
                  <span className={`badge ${rarityClass(s.rarity)}`}>{s.rarity || '—'}</span>
                  <span style={{ fontSize:'0.8rem', opacity:0.8, color:'var(--text-color)' }}>{perItemOddsText(s.rarity)}</span>
                </div>
              </div>
              {skinImgMap[s.slug] ? (
                <img className="category-img" src={skinImgMap[s.slug]} alt={s.name} style={{ width: 120, height: 120 }} />
              ) : (
                <div className="category-icon" aria-hidden="true" style={{ width: 120, height: 120 }}></div>
              )}
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:12, fontSize:'0.95rem', color:'var(--text-color)' }}>
                <span style={{ opacity:0.8, color:'var(--text-color)' }}>Price</span>
                <span style={{ fontWeight:600, color:'var(--text-color)' }}>{formatPrice(s.current_price)}</span>
              </div>
            </button>
          ))}
        </div>
      )}

      {knifeItems.length > 0 ? (
        <>
          <h3 style={{ marginTop:20 }}>Contained Knives</h3>
          <div className="categories-grid" style={{ gridTemplateColumns:'repeat(auto-fill, minmax(240px, 1fr))' }}>
            {knifeItems.map(kn => (
              <button
                key={kn.item_id}
                className="category-card"
                style={{ padding: '22px 18px' }}
                onClick={() => navigate(`/skin/${kn.slug}`)}
              >
                <div className="card-header">
                  <div className="category-label" style={{ fontSize:'1.05rem', color:'var(--text-color)' }}>{kn.name}</div>
                  <div style={{ marginTop:6, display:'flex', alignItems:'center', gap:8 }}>
                    <span className={`badge ${rarityClass(kn.rarity)}`}>{kn.rarity || '—'}</span>
                    <span style={{ fontSize:'0.8rem', opacity:0.8, color:'var(--text-color)' }}>{knifePerItemOdds}</span>
                  </div>
                </div>
                {skinImgMap[kn.slug] ? (
                  <img className="category-img" src={skinImgMap[kn.slug]} alt={kn.name} style={{ width: 120, height: 120 }} />
                ) : (
                  <div className="category-icon" aria-hidden="true" style={{ width: 120, height: 120 }}></div>
                )}
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:12, fontSize:'0.95rem', color:'var(--text-color)' }}>
                  <span style={{ opacity:0.8, color:'var(--text-color)' }}>Price</span>
                  <span style={{ fontWeight:600, color:'var(--text-color)' }}>{formatPrice(kn.current_price)}</span>
                </div>
              </button>
            ))}
          </div>
        </>
      ) : null}

      {gloveItems.length > 0 ? (
        <>
          <h3 style={{ marginTop:20 }}>Contained Gloves</h3>
          <div className="categories-grid" style={{ gridTemplateColumns:'repeat(auto-fill, minmax(240px, 1fr))' }}>
            {gloveItems.map(gl => (
              <button
                key={gl.item_id}
                className="category-card"
                style={{ padding: '22px 18px' }}
                onClick={() => navigate(`/skin/${gl.slug}`)}
              >
                <div className="card-header">
                  <div className="category-label" style={{ fontSize:'1.05rem', color:'var(--text-color)' }}>{gl.name}</div>
                  <div style={{ marginTop:6, display:'flex', alignItems:'center', gap:8 }}>
                    <span className={`badge ${rarityClass(gl.rarity)}`}>{gl.rarity || '—'}</span>
                    <span style={{ fontSize:'0.8rem', opacity:0.8, color:'var(--text-color)' }}>{glovePerItemOdds}</span>
                  </div>
                </div>
                {skinImgMap[gl.slug] ? (
                  <img className="category-img" src={skinImgMap[gl.slug]} alt={gl.name} style={{ width: 120, height: 120 }} />
                ) : (
                  <div className="category-icon" aria-hidden="true" style={{ width: 120, height: 120 }}></div>
                )}
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:12, fontSize:'0.95rem', color:'var(--text-color)' }}>
                  <span style={{ opacity:0.8, color:'var(--text-color)' }}>Price</span>
                  <span style={{ fontWeight:600, color:'var(--text-color)' }}>{formatPrice(gl.current_price)}</span>
                </div>
              </button>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}

export default CaseDetailPage;