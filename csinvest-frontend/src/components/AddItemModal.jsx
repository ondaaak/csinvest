import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../auth/AuthContext.jsx';

const BASE_URL = 'http://127.0.0.1:8000';

function AddItemModal({ onClose, onAdded }) {
  const { userId } = useAuth();
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const boxRef = useRef(null);
  const [amount, setAmount] = useState(1);
  const [floatValue, setFloatValue] = useState('');
  const [pattern, setPattern] = useState('');
  const [buyPrice, setBuyPrice] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const token = localStorage.getItem('csinvest:token');

  const slugNormalize = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  const skinsGlob = import.meta.glob('../assets/skins/*.{png,jpg,jpeg,svg,webp}', { eager: true, query: '?url', import: 'default' });
  const glovesGlob = import.meta.glob('../assets/gloves/*.{png,jpg,jpeg,svg,webp}', { eager: true, query: '?url', import: 'default' });
  const casesGlob = import.meta.glob('../assets/cases/*.{png,jpg,jpeg,svg,webp}', { eager: true, query: '?url', import: 'default' });
  const assetFromFolder = (globObj) => Object.fromEntries(
    Object.entries(globObj).map(([p, url]) => {
      const filename = p.split('/').pop() || '';
      const keyRaw = filename.substring(0, filename.lastIndexOf('.'));
      return [slugNormalize(keyRaw), url];
    })
  );
  const itemThumbs = { ...assetFromFolder(skinsGlob), ...assetFromFolder(glovesGlob), ...assetFromFolder(casesGlob) };

  useEffect(() => {
    const q = query.trim();
    if (!q) { setSuggestions([]); setOpen(false); return; }
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`${BASE_URL}/search?q=${encodeURIComponent(q)}&limit=8`);
        if (res.ok) {
          const data = await res.json();
          const arr = Array.isArray(data) ? data : [];
          setSuggestions(arr); setOpen(arr.length > 0);
        } else { setSuggestions([]); setOpen(false); }
      } catch { setSuggestions([]); setOpen(false); }
    }, 200);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    const handleClick = (e) => { if (!boxRef.current) return; if (!boxRef.current.contains(e.target)) setOpen(false); };
    const handleKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => { document.removeEventListener('mousedown', handleClick); document.removeEventListener('keydown', handleKey); };
  }, [onClose]);

  const parsePrice = (val) => {
    if (!val) return 0;
    const cleaned = String(val).replace(/[^0-9.,-]/g, '').replace(',', '.');
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!userId) { setError('Please login first.'); return; }
    if (!selected?.item_id) { setError('Select an item.'); return; }
    const payload = {
      item_id: selected.item_id,
      amount: Number(amount) || 1,
      float_value: floatValue ? Number(floatValue) : null,
      pattern: pattern ? Number(pattern) : null,
      buy_price: parsePrice(buyPrice),
    };
    setLoading(true); setError(null);
    try {
      const res = await fetch(`${BASE_URL}/useritems`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        let msg = 'Request failed';
        try { const data = await res.json(); msg = data.detail || msg; } catch {}
        throw new Error(msg);
      }
      if (onAdded) onAdded();
      onClose();
    } catch (e) { setError(e.message || 'Saving failed.'); } finally { setLoading(false); }
  };

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <div className="modal-container" onClick={(e) => e.stopPropagation()}>
        <h3 style={{ marginTop:0, marginBottom:16 }}>Add New Item</h3>
        <form onSubmit={onSubmit}>
          <label className="form-label">Name</label>
          <div ref={boxRef} style={{ position:'relative' }}>
            <input className="form-input" placeholder="Search item" value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => { if (query.trim() && suggestions.length > 0) setOpen(true); }} />
            {open && query && suggestions.length > 0 && (
              <div className="search-suggestions">
                {suggestions.map((s) => (
                  <button key={s.slug} type="button" className="search-suggestion-row"
                    onClick={() => { setSelected(s); setQuery(s.name); setOpen(false); }}>
                    {(() => { const thumb = itemThumbs[s.slug] || null; return thumb ? (<div className="search-thumb"><img src={thumb} alt={s.name} /></div>) : (<div className="category-icon" aria-hidden="true"></div>); })()}
                    <div className="search-text">
                      <div className="search-name">{s.name}</div>
                      <div className="search-type">{s.item_type}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <label className="form-label">Amount</label>
          <input className="form-input" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="1" />
          <label className="form-label">Float</label>
          <input className="form-input" value={floatValue} onChange={(e) => setFloatValue(e.target.value)} placeholder="0.00243581975" />
          <label className="form-label">Pattern</label>
          <input className="form-input" value={pattern} onChange={(e) => setPattern(e.target.value)} placeholder="123" />
          <label className="form-label">BuyPrice (unit)</label>
          <input className="form-input" value={buyPrice} onChange={(e) => setBuyPrice(e.target.value)} placeholder="1000€" />
          <div className="help-text">Jednotková cena (za 1 kus)</div>

          {error && <div className="error-text" style={{ marginTop: 8 }}>{error}</div>}

          <div style={{ display:'flex', gap:12, marginTop:16 }}>
            <button type="submit" className="account-button" disabled={loading}>{loading ? 'Saving…' : 'Add'}</button>
            <button type="button" className="account-button" onClick={onClose} style={{ background:'#444' }}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default AddItemModal;
