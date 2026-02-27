import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { useAuth } from '../auth/AuthContext.jsx';
import { useNavigate } from 'react-router-dom';

const BASE_URL = 'http://127.0.0.1:8000';

function AddItemPage() {
  const { userId } = useAuth();
  const navigate = useNavigate();
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
  const charmsGlob = import.meta.glob('../assets/charms/*.{png,jpg,jpeg,svg,webp}', { eager: true, query: '?url', import: 'default' });
  const assetFromFolder = (globObj) => Object.fromEntries(
    Object.entries(globObj).map(([p, url]) => {
      const filename = p.split('/').pop() || '';
      const keyRaw = filename.substring(0, filename.lastIndexOf('.'));
      return [slugNormalize(keyRaw), url];
    })
  );
  const itemThumbs = {
    ...assetFromFolder(skinsGlob),
    ...assetFromFolder(glovesGlob),
    ...assetFromFolder(casesGlob),
    ...assetFromFolder(charmsGlob),
  };

  // Debug logs
  useEffect(() => {
    // console.log('Loaded charm thumbs keys:', Object.keys(assetFromFolder(charmsGlob)));
  }, []);


  useEffect(() => {
    const q = query.trim();
    if (!q) { setSuggestions([]); setOpen(false); return; }
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`${BASE_URL}/search?q=${encodeURIComponent(q)}&limit=8&exclude_item_type=collection`);
        if (res.ok) {
          const data = await res.json();
          const arr = Array.isArray(data) ? data : [];
          setSuggestions(arr);
          setOpen(arr.length > 0);
        } else {
          setSuggestions([]);
          setOpen(false);
        }
      } catch {
        setSuggestions([]);
        setOpen(false);
      }
    }, 200);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    const handleClick = (e) => {
      if (!boxRef.current) return;
      if (!boxRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    const handleKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, []);

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
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${BASE_URL}/useritems`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        let msg = 'Request failed';
        try { const data = await res.json(); msg = data.detail || msg; } catch {}
        throw new Error(msg);
      }
      navigate('/inventory');
    } catch (e) {
      setError(e.message || 'Saving failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="dashboard-container">
      <h2 style={{ textAlign: 'center' }}>New Item</h2>
      <form onSubmit={onSubmit} className="card" style={{ maxWidth: 520, margin: '0 auto' }}>
        <label className="form-label">Name</label>
        <div ref={boxRef} style={{ position:'relative' }}>
          <input
            className="form-input"
            placeholder="Search item"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => { if (query.trim() && suggestions.length > 0) setOpen(true); }}
          />
          {open && query && suggestions.length > 0 && (
            <div className="search-suggestions">
              {suggestions.map((s) => (
                <button
                  key={s.slug}
                  type="button"
                  onClick={() => { setSelected(s); setQuery(s.name); setOpen(false); }}
                  className="search-suggestion-row"
                >
                  {(() => {
                    const thumb = itemThumbs[s.slug] || null;
                    return thumb ? (
                      <div className="search-thumb">
                        <img src={thumb} alt={s.name} />
                      </div>
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

        <label className="form-label">Pattern</label>
        <input className="form-input" value={pattern} onChange={(e) => setPattern(e.target.value)} placeholder="123" />

        <label className="form-label">BuyPrice</label>
        <input className="form-input" value={buyPrice} onChange={(e) => setBuyPrice(e.target.value)} placeholder="1000€" />

        {error && <div className="error-text" style={{ marginTop: 8 }}>{error}</div>}

        <button className="account-button" type="submit" disabled={loading} style={{ marginTop: 12 }}>
          {loading ? 'Saving…' : 'Add ↗'}
        </button>
      </form>
    </div>
  );
}

export default AddItemPage;