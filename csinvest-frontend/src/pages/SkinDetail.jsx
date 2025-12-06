import React, { useEffect, useState, useMemo } from 'react';
import axios from 'axios';
import { useParams, useNavigate } from 'react-router-dom';
import { useCurrency } from '../currency/CurrencyContext.jsx';

const BASE_URL = 'http://127.0.0.1:8000';

function SkinDetailPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { formatPrice } = useCurrency();
  const [item, setItem] = useState(null);
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

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await axios.get(`${BASE_URL}/items/${slug}`);
        setItem(res.data);
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

  const sortedKeys = useMemo(() => {
    return Object.keys(skinImgMap).sort((a, b) => b.length - a.length);
  }, [skinImgMap]);

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

  return (
    <div className="dashboard-container">
      <div style={{ display:'flex', alignItems:'center', gap:12, flexWrap:'wrap', marginBottom:12 }}>
        <button onClick={() => navigate(-1)} aria-label="Back" style={{
          background:'var(--button-bg)', color:'var(--button-text)', border:'1px solid var(--border-color)', borderRadius:10, padding:'6px 10px', cursor:'pointer'
        }}>←</button>
        <h2 style={{ margin:0, flex:1 }}>{item.name}</h2>
        <span className={`badge ${rarityClass(item.rarity)}`}>{item.rarity || '—'}</span>
      </div>
      <div className="stat-card" style={{ background:'var(--surface-bg)', color:'var(--text-color)' }}>
        {img && (
          <img src={img} alt={item.name} style={{ width:160, height:160, objectFit:'contain', borderRadius:12, marginBottom:12 }} />
        )}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(180px, 1fr))', gap:12, fontSize:'0.9rem' }}>
          <div><strong>Rarity:</strong> {item.rarity || '—'}</div>
          <div><strong>Wear:</strong> {item.wear || '—'}</div>
          <div><strong>Collection:</strong> {item.collection || '—'}</div>
          <div><strong>Current Price:</strong> {formatPrice(item.current_price)}</div>
        </div>
      </div>
    </div>
  );
}

export default SkinDetailPage;
