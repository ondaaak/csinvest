import React, { useEffect, useState, useMemo } from 'react';
import axios from 'axios';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useCurrency } from '../currency/CurrencyContext.jsx';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const BASE_URL = 'http://127.0.0.1:8000';

function SkinDetailPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { formatPrice } = useCurrency();
  const [item, setItem] = useState(null);
  const [cases, setCases] = useState([]);
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

  const sortedKeys = useMemo(() => {
    return Object.keys(skinImgMap).sort((a, b) => b.length - a.length);
  }, [skinImgMap]);

  const sortedCaseKeys = useMemo(() => {
    return Object.keys(caseImgMap).sort((a, b) => b.length - a.length);
  }, [caseImgMap]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await axios.get(`${BASE_URL}/items/${slug}`);
        if (res.data.item) {
            setItem(res.data.item);
            setCases(res.data.cases || []);
        } else {
            setItem(res.data);
            setCases([]);
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

  const getCaseImage = (caseSlug) => {
      if (!caseSlug) return null;
      const s = caseSlug.toLowerCase();
      if (caseImgMap[s]) return caseImgMap[s];
      
      const match = sortedCaseKeys.find(key => s.startsWith(key));
      if (match) return caseImgMap[match];
      return null;
  }

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
      default:
        return '';
    }
  };

  const sortedHistory = [...history].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  const finalChartData = sortedHistory.map(h => ({
      date: new Date(h.timestamp).toLocaleDateString(),
      price: h.price
  }));

  return (
    <div className="dashboard-container">
      <div style={{ display:'flex', alignItems:'center', gap:12, flexWrap:'wrap', marginBottom:12 }}>
        <button onClick={() => navigate(-1)} aria-label="Back" style={{
          background:'var(--button-bg)', color:'var(--button-text)', border:'1px solid var(--border-color)', borderRadius:10, padding:'6px 10px', cursor:'pointer'
        }}>←</button>
        <h2 style={{ margin:0, flex:1 }}>{item.name}</h2>
        <span className={`badge ${rarityClass(item.rarity)}`}>{item.rarity || '—'}</span>
      </div>
      
      <div className="stat-card" style={{ background:'var(--surface-bg)', color:'var(--text-color)', marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
            {img && (
            <img src={img} alt={item.name} style={{ width:200, height:200, objectFit:'contain', borderRadius:12 }} />
            )}
            <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(180px, 1fr))', gap:12, fontSize:'0.9rem' }}>
                <div><strong>Current Price:</strong> {formatPrice(item.current_price)}</div>
                </div>
                
                {cases.length > 0 && (
                    <div style={{ marginTop: 20 }}>
                        <strong>Found in cases:</strong>
                        <div style={{ display: 'flex', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
                            {cases.map(c => {
                                const cImg = getCaseImage(c.slug);
                                return (
                                    <Link to={`/case/${c.slug}`} key={c.item_id} style={{ textAlign: 'center', width: 80, textDecoration: 'none', color: 'inherit' }} title={c.name}>
                                        {cImg ? (
                                            <img src={cImg} alt={c.name} style={{ width: 60, height: 60, objectFit: 'contain' }} />
                                        ) : (
                                            <div style={{ width: 60, height: 60, background: '#333', borderRadius: 8 }}></div>
                                        )}
                                        <div style={{ fontSize: '0.7rem', marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</div>
                                        <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary, #aaa)' }}>{formatPrice(c.current_price)}</div>
                                    </Link>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>
        </div>
      </div>

      {finalChartData.length > 0 && (
          <div className="stat-card" style={{ background:'var(--surface-bg)', color:'var(--text-color)', height: 400 }}>
              <h3>Price History</h3>
              <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={finalChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#444" />
                      <XAxis dataKey="date" stroke="#888" />
                      <YAxis stroke="#888" />
                      <Tooltip contentStyle={{ backgroundColor: '#222', border: '1px solid #444' }} />
                      <Line type="monotone" dataKey="price" stroke="#8884d8" dot={false} />
                  </LineChart>
              </ResponsiveContainer>
          </div>
      )}
    </div>
  );
}

export default SkinDetailPage;
