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

  // Images by slug from src/assets/cases
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

  const { case: cs, skins } = data;

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

  return (
    <div className="dashboard-container">
      <div style={{ display:'flex', alignItems:'center', gap:12, flexWrap:'wrap', marginBottom:12 }}>
        <button onClick={() => navigate(-1)} aria-label="Back" style={{
          background:'var(--button-bg)', color:'var(--button-text)', border:'1px solid var(--border-color)', borderRadius:10, padding:'6px 10px', cursor:'pointer'
        }}>←</button>
        <h2 style={{ margin:0, flex:1 }}>{cs.name}</h2>
        <div style={{
          fontSize:'0.7rem', padding:'4px 8px', borderRadius:8, background:badge.bg, color:badge.color, fontWeight:600
        }}>{badge.label.toUpperCase()}</div>
        <button onClick={doRefresh} disabled={refreshing} style={{
          background:'var(--button-bg)', color:'var(--button-text)', border:'1px solid var(--border-color)', borderRadius:10, padding:'8px 12px', cursor: refreshing ? 'not-allowed':'pointer'
        }}>{refreshing ? 'Refreshing…' : 'Refresh prices'}</button>
      </div>
      <div className="stat-card" style={{ background:'var(--surface-bg)', color:'var(--text-color)' }}>
        {caseImgMap[slug] && (
          <img src={caseImgMap[slug]} alt={cs.name} style={{ width:120, height:120, objectFit:'cover', borderRadius:12, marginBottom:12 }} />
        )}
        <div style={{ display:'flex', gap:'12px', flexWrap:'wrap', fontSize:'0.85rem' }}>
          <div><strong>Release:</strong> {cs.release_date || '—'}</div>
          <div><strong>Status:</strong> {badge.label}</div>
          <div><strong>Current Price:</strong> {formatPrice(cs.current_price)}</div>
        </div>
      </div>

      <h3 style={{ marginTop:0 }}>Contained Skins</h3>
      {(!skins || skins.length === 0) && <div style={{ opacity:0.6, fontSize:'0.85rem' }}>No skins linked to this case yet.</div>}
      {skins && skins.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Rarity</th>
              <th>Wear</th>
              <th>Collection</th>
              <th>Price</th>
            </tr>
          </thead>
          <tbody>
            {skins.map(s => (
              <tr key={s.item_id}>
                <td>{s.name}</td>
                <td>{s.rarity || '—'}</td>
                <td>{s.wear || '—'}</td>
                <td>{s.collection || '—'}</td>
                <td>{formatPrice(s.current_price)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default CaseDetailPage;