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
  const [refreshing, setRefreshing] = useState(false);
  const [history, setHistory] = useState([]);
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
        // načti historii ceny pro graf
        const h = await axios.get(`${BASE_URL}/items/${slug}/history`, { params: { limit: 200 } });
        setHistory(Array.isArray(h.data?.history) ? h.data.history : []);
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

  // formátování release date a ceny
  const releaseText = (() => {
    const d = cs.release_date;
    if (!d) return '—';
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return d;
    return dt.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: '2-digit' });
  })();
  const currentPriceText = formatPrice(cs.current_price);
  const lastUpdateText = (() => {
    const src = (history && history.length > 0) ? history[history.length - 1]?.timestamp : cs.last_update;
    if (!src) return null;
    const dt = new Date(src);
    if (isNaN(dt.getTime())) return String(src);
    return dt.toLocaleString(undefined, { year:'numeric', month:'short', day:'2-digit', hour:'2-digit', minute:'2-digit' });
  })();

  // připrav jednoduchý SVG line chart
  const Chart = ({ points }) => {
    const w = 800, h = 200, pad = 24;
    const [hover, setHover] = React.useState(null);
    if (!points || points.length < 2) return <div style={{ opacity: 0.7, fontSize: '0.85rem' }}>No history yet.</div>;
    const xs = points.map((p) => new Date(p.timestamp).getTime());
    const ys = points.map((p) => Number(p.price) || 0);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    const normX = (t) => pad + ((t - minX) / (maxX - minX || 1)) * (w - 2 * pad);
    const normY = (v) => h - pad - ((v - minY) / (maxY - minY || 1)) * (h - 2 * pad);
    const coords = points.map((p) => ({
      x: normX(new Date(p.timestamp).getTime()),
      y: normY(Number(p.price) || 0),
      p,
    }));
    const path = coords
      .map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x} ${c.y}`)
      .join(' ');
    const last = points[points.length - 1];
    const first = points[0];
    const onMove = (e) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const relX = ((e.clientX - rect.left) / rect.width) * w;
      // find nearest point by x
      let nearest = null;
      let best = Infinity;
      for (const c of coords) {
        const d = Math.abs(c.x - relX);
        if (d < best) { best = d; nearest = c; }
      }
      setHover(nearest);
    };
    const onLeave = () => setHover(null);
    return (
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ width: '100%', height: h }} onMouseMove={onMove} onMouseLeave={onLeave}>
        <rect x={0} y={0} width={w} height={h} fill="var(--surface-bg)" rx={8} />
        <path d={path} stroke="var(--accent-color)" strokeWidth={2} fill="none" />
        {/* axes */}
        <line x1={pad} y1={h - pad} x2={w - pad} y2={h - pad} stroke="var(--surface-border)" />
        <line x1={pad} y1={pad} x2={pad} y2={h - pad} stroke="var(--surface-border)" />
        {/* hover dot and tooltip */}
        {hover && (
          <g>
            <circle cx={hover.x} cy={hover.y} r={4} fill="var(--accent-color)" />
            <rect x={Math.min(Math.max(hover.x + 8, pad), w - 160)} y={hover.y - 28} width={150} height={24} rx={6} fill="var(--surface-border)" />
            <text x={Math.min(Math.max(hover.x + 16, pad + 8), w - 152)} y={hover.y - 12} fill="var(--text-color)" fontSize={12}>
              {formatPrice(hover.p.price)} • {new Date(hover.p.timestamp).toLocaleDateString()}
            </text>
          </g>
        )}
        {/* labels */}
        <text x={pad} y={pad - 6} fill="var(--text-color)" fontSize={12}>{formatPrice(first.price)}</text>
        <text x={pad} y={h - 6} fill="var(--text-color)" fontSize={12}>{new Date(first.timestamp).toLocaleDateString()}</text>
        <text x={w - pad - 60} y={pad - 6} fill="var(--text-color)" fontSize={12} textAnchor="end">{formatPrice(last.price)}</text>
        <text x={w - pad} y={h - 6} fill="var(--text-color)" fontSize={12} textAnchor="end">{new Date(last.timestamp).toLocaleDateString()}</text>
      </svg>
    );
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

  return (
    <div className="dashboard-container">
      {/* Header: center the whole row within a max-width container */}
      <div style={{ display:'flex', justifyContent:'center', marginBottom:12 }}>
        <div style={{ display:'grid', gridTemplateColumns:'auto 1fr auto', alignItems:'center', gap:12, width:'100%', maxWidth:820 }}>
          <button onClick={() => navigate(-1)} aria-label="Back" style={{
            background:'var(--button-bg)', color:'var(--button-text)', border:'1px solid var(--border-color)', borderRadius:10, padding:'6px 10px', cursor:'pointer'
          }}>←</button>
          <h2 style={{ margin:0, textAlign:'center' }}>{cs.name}</h2>
          <div style={{ display:'flex', alignItems:'center', gap:12, justifyContent:'flex-end' }}>
            <div style={{
              fontSize:'0.7rem', padding:'4px 8px', borderRadius:8, background:badge.bg, color:badge.color, fontWeight:600
            }}>{badge.label.toUpperCase()}</div>
            <button disabled style={{
              background:'var(--button-bg)', color:'var(--button-text)', border:'1px solid var(--border-color)', borderRadius:10, padding:'8px 12px', cursor: refreshing ? 'not-allowed':'pointer'
            }}>Refresh prices</button>
          </div>
        </div>
      </div>
      {/* Details card: centered container with fixed max width */}
      <div style={{ display:'flex', justifyContent:'center' }}>
        <div className="stat-card" style={{ background:'var(--surface-bg)', color:'var(--text-color)', position:'relative', maxWidth:820, width:'100%' }}>
        {/* Release top-left, above image (restore old) */}
        <div style={{ position:'absolute', top:12, left:12, fontSize:'0.95rem' }}>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <span style={{ padding:'4px 8px', borderRadius:999, background:'var(--surface-border)', color:'var(--text-color)', fontWeight:600 }}>Release</span>
            <span style={{ opacity:0.9 }}>{releaseText}</span>
          </div>
        </div>
          {/* Two-column row: center Image + right Buy/Sell links; centered container */}
          <div style={{ display:'grid', gridTemplateColumns:'none', gap:18, alignItems:'center', margin:'24px 0 12px 0', justifyContent:'center' }}>
            {/* Image */}
            <div style={{ width:160, height:160, display:'flex', alignItems:'center', justifyContent:'center', background:'var(--surface-bg)', border:'1px solid var(--surface-border)', borderRadius:16, margin:'0 auto', padding:12 }}>
              {caseImgMap[slug] && (
                <img src={caseImgMap[slug]} alt={cs.name} style={{ maxWidth:'100%', maxHeight:'100%', objectFit:'contain' }} />
              )}
            </div>
            {/* Buy/Sell links */}
            <div style={{ display:'flex', justifyContent:'center', marginLeft:16 }}>
              <div>
                <div style={{ fontWeight:700, marginBottom:16 }}>Buy / Sell</div>
                <div style={{ display:'flex', gap:12, alignItems:'center', flexWrap:'wrap' }}>
                  <a href={`https://csfloat.com/?query=${encodeURIComponent(cs.name)}`} target="_blank" rel="noreferrer" title="CSFloat" style={{
                    width:44, height:44, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center',
                    background:'rgba(84, 84, 99, 0.27)', color:'var(--text-color)', border:'1px solid var(--surface-border)', textDecoration:'none'
                  }}>
                    <img src={csfloatLogo} alt="CSFloat" style={{ width:24, height:24, objectFit:'contain' }} />
                  </a>
                  <a href={`https://haloskins.com/search?q=${encodeURIComponent(cs.name)}`} target="_blank" rel="noreferrer" title="HaloSkins" style={{
                    width:44, height:44, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center',
                    background:'rgba(34,197,94,0.2)', color:'var(--text-color)', border:'1px solid var(--surface-border)', textDecoration:'none'
                  }}>
                    <img src={haloskinsLogo} alt="HaloSkins" style={{ width:24, height:24, objectFit:'contain' }} />
                  </a>
                </div>
              </div>
            </div>
          </div>
        {/* Current Price centered under image with extra top spacing */}
        <div style={{ display:'flex', justifyContent:'center', marginTop:16 }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <span style={{ opacity:0.75 }}>Current Price</span>
            <span title={lastUpdateText ? `Last update: ${lastUpdateText}` : undefined} style={{ padding:'6px 12px', borderRadius:8, background:'rgba(99,102,241,0.15)', color:'var(--text-color)', fontWeight:700, border:'1px solid var(--surface-border)' }}>
              {currentPriceText}
            </span>
          </div>
        </div>
        </div>
      </div>

      {/* Price History as its own section, outside and centered card */}
      <div style={{ marginTop:12, display:'flex', justifyContent:'center' }}>
        <div className="stat-card" style={{ background:'var(--surface-bg)', color:'var(--text-color)', maxWidth:820, width:'100%' }}>
          <h3 style={{ marginTop:0, textAlign:'center' }}>Price History</h3>
          <div style={{ display:'flex', justifyContent:'center', alignItems:'center' }}>
            <Chart points={history} />
          </div>
        </div>
      </div>

      <h3 style={{ marginTop:0 }}>Contained Skins</h3>
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
              {getSkinImage(s.slug, s.name) ? (
                <img className="category-img" src={getSkinImage(s.slug, s.name)} alt={s.name} style={{ width: 120, height: 120 }} />
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
                {getSkinImage(kn.slug, kn.name) ? (
                  <img className="category-img" src={getSkinImage(kn.slug, kn.name)} alt={kn.name} style={{ width: 120, height: 120 }} />
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
                {getSkinImage(gl.slug, gl.name) ? (
                  <img className="category-img" src={getSkinImage(gl.slug, gl.name)} alt={gl.name} style={{ width: 120, height: 120 }} />
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