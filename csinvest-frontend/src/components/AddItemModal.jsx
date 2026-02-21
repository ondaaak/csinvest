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
  const [buyPrice, setBuyPrice] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const token = localStorage.getItem('csinvest:token');

  // --- Image Loading Logic (ported from Inventory.jsx) ---
  const skinsGlob = import.meta.glob('../assets/skins/*.{png,jpg,jpeg,svg,webp}', { eager: true, query: '?url', import: 'default' });
  const glovesGlob = import.meta.glob('../assets/gloves/*.{png,jpg,jpeg,svg,webp}', { eager: true, query: '?url', import: 'default' });
  const casesGlob = import.meta.glob('../assets/cases/*.{png,jpg,jpeg,svg,webp}', { eager: true, query: '?url', import: 'default' });
  
  const assetFromFolder = (globObj) => Object.fromEntries(
    Object.entries(globObj).map(([p, url]) => {
      const filename = p.split('/').pop() || '';
      const keyRaw = filename.substring(0, filename.lastIndexOf('.'));
      return [keyRaw.toLowerCase(), url];
    })
  );
  
  const itemThumbs = { 
    ...assetFromFolder(skinsGlob), 
    ...assetFromFolder(glovesGlob), 
    ...assetFromFolder(casesGlob) 
  };
  
  const sortedKeys = Object.keys(itemThumbs).sort((a, b) => b.length - a.length);

  const getImage = (slug, itemName) => {
    // 1. Try simple slug match
    if (slug) {
      const s = slug.toLowerCase();
      if (itemThumbs[s]) return itemThumbs[s];

      // 2. Try prefix match on slug
      const match = sortedKeys.find(key => s.startsWith(key));
      if (match) return itemThumbs[match];
      
      // 3. Reverse match
      const reverseMatch = sortedKeys.find(key => key.startsWith(s));
      if (reverseMatch) return itemThumbs[reverseMatch];
    }

    // 4. Fallback: aggressive name matching
    if (itemName) {
      const base = itemName.toLowerCase()
        .replace(/[|]+/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");
      if (itemThumbs[base]) return itemThumbs[base];
      
      // 5. Try to find if the cleaned name is contained in keys or vice versa
      const nameMatch = sortedKeys.find(key => base.includes(key) || key.includes(base));
      if (nameMatch) return itemThumbs[nameMatch];
    }
    
    return null;
  };

  useEffect(() => {
    const q = query.trim();
    if (selected && q === (selected.name || '').trim()) { setSuggestions([]); setOpen(false); return; }
    if (!q) { setSuggestions([]); setOpen(false); return; }
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`${BASE_URL}/search?q=${encodeURIComponent(q)}&limit=8&exclude_item_type=collection`);
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

  const handleOverlayMouseDown = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div className="modal-overlay" onMouseDown={handleOverlayMouseDown}>
      <div className="modal-container" onClick={(e) => e.stopPropagation()}>
        <h3 style={{ marginTop:0, marginBottom:16 }}>Add New Item</h3>
        <form onSubmit={onSubmit}>
          <label className="form-label">Name</label>
          <div ref={boxRef} style={{ position:'relative' }}>
            <input className="form-input" placeholder="Search item" value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => { const q = query.trim(); if (q && suggestions.length > 0 && !(selected && q === (selected.name || '').trim())) setOpen(true); }} />
            {open && query && suggestions.length > 0 && (
              <div className="search-suggestions">
                {suggestions.map((s) => (
                  <button key={s.slug} type="button" className="search-suggestion-row"
                    onClick={() => { setSelected(s); setQuery(s.name); setSuggestions([]); setOpen(false); }}>
                    {(() => { 
                      const thumb = getImage(s.slug, s.name);
                      return thumb ? (
                        <div className="search-thumb"><img src={thumb} alt={s.name} /></div>
                      ) : (
                        <div className="category-icon" aria-hidden="true"></div>
                      ); 
                    })()}
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
          <label className="form-label">Buy Price (USD unit)</label>
          <input className="form-input" value={buyPrice} onChange={(e) => setBuyPrice(e.target.value)} placeholder="$100" />
          <div className="help-text">Jednotková cena v USD (za 1 kus)</div>

          {error && <div className="error-text" style={{ marginTop: 8 }}>{error}</div>}

          <div style={{ display:'flex', gap:12, marginTop:16, justifyContent:'center' }}>
            <button type="submit" className="account-button" disabled={loading}>{loading ? 'Saving…' : 'Add'}</button>
            <button type="button" className="account-button" onClick={onClose} style={{ background:'#444' }}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default AddItemModal;
