import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../auth/AuthContext.jsx';
import axios from 'axios';
import { useAppModal } from '../components/AppModalProvider.jsx';

const BASE_URL = '/api';

const buildAuthConfig = () => {
  const token = localStorage.getItem('csinvest:token');
  const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
  return { withCredentials: true, headers };
};

export default function AccountPage() {
  const { user, userId, logout } = useAuth();
  const { showAlert, showConfirm } = useAppModal();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  // Local state for portfolio webhook to ensure we have latest even if context is stale
  const [portfolioWebhook, setPortfolioWebhook] = useState(null);
  
  // CSFloat API Key State
  const [csfloatKeySet, setCsfloatKeySet] = useState(false);
  const [csfloatKeyInput, setCsfloatKeyInput] = useState('');
  const [showKeyInput, setShowKeyInput] = useState(false);

  // Fetch CSFloat key status
  useEffect(() => {
    const fetchKeyStatus = async () => {
        try {
        const res = await axios.get(`${BASE_URL}/user/csfloat/status`, buildAuthConfig());
            setCsfloatKeySet(res.data.is_set);
        } catch (e) { console.error(e); }
    };
    if (userId) fetchKeyStatus();
  }, [userId]);

  const saveCsfloatKey = async () => {
      if (!csfloatKeyInput.trim()) return;
      try {
        await axios.post(`${BASE_URL}/user/csfloat`, { api_key: csfloatKeyInput }, buildAuthConfig());
          setCsfloatKeySet(true);
          setCsfloatKeyInput('');
          setShowKeyInput(false);
          // alert("CSFloat API Key saved safely!");
      } catch (e) {
          console.error(e);
          await showAlert('Failed to save key', { title: 'CSFloat API Key' });
      }
  };

  const deleteCsfloatKey = async () => {
      if (!(await showConfirm('Are you sure you want to remove your CSFloat API Key?', { title: 'Remove API Key', confirmText: 'Confirm' }))) return;
      try {
        await axios.delete(`${BASE_URL}/user/csfloat`, buildAuthConfig());
          setCsfloatKeySet(false);
          // alert("CSFloat API Key removed!");
      } catch (e) {
          console.error(e);
        await showAlert('Failed to remove key', { title: 'CSFloat API Key' });
      }
  };

  // ... imports ...

  // Fetch latest user data to get webhook
  useEffect(() => {
    const fetchMe = async () => {
        try {
            const res = await axios.get(`${BASE_URL}/auth/me`, buildAuthConfig());
            setPortfolioWebhook(res.data.discord_portfolio_webhook_url);
            // Optionally update global context if meaningful
            // setUser(res.data); 
        } catch (e) { console.error(e); }
    };
    fetchMe();
  }, [userId]);
  
  // ... existing code ...
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
  
  const itemThumbs = useMemo(() => ({
    ...assetFromFolder(skinsGlob),
    ...assetFromFolder(glovesGlob),
    ...assetFromFolder(casesGlob),
  }), []);

  const sortedKeys = useMemo(() => {
    return Object.keys(itemThumbs).sort((a, b) => b.length - a.length);
  }, [itemThumbs]);

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
      const nameMatch = sortedKeys.find(key => base.includes(key) || key.includes(base));
      if (nameMatch) return itemThumbs[nameMatch];
    }
    return null;
  };
    
  const fetchItems = async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const res = await axios.get(`${BASE_URL}/portfolio/${userId}`, buildAuthConfig());
      setItems(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user && userId) {
        fetchItems();
    }
  }, [userId, user]);

  const removePortfolioWebhook = async () => {
    if (!(await showConfirm('Stop portfolio-wide notifications?', { title: 'Disable notifications', confirmText: 'Stop' }))) return;
    try {
        await axios.patch(`${BASE_URL}/users/me`, 
            { discord_portfolio_webhook_url: null }, 
        buildAuthConfig()
        );
        setPortfolioWebhook(null);
    } catch (e) {
        await showAlert(e.message || 'Failed to disable notifications');
    }
  };

  const removeWebhook = async (item) => {
    if (!(await showConfirm(`Stop notifications for ${item.item?.name}?`, { title: 'Disable item notification', confirmText: 'Stop' }))) return;
    try {
      const token = localStorage.getItem('csinvest:token');
      const headers = { 'Content-Type': 'application/json' };
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }
      // Use helper if axios has issues with null body field or config order
      const res = await fetch(`${BASE_URL}/useritems/${item.user_item_id}`, {
          method: 'PATCH',
          credentials: 'include',
          headers,
          body: JSON.stringify({ discord_webhook_url: null })
      });
      if (!res.ok) throw new Error('Failed to remove webhook');
      
      // Update state
      setItems(prev => prev.map(i => i.user_item_id === item.user_item_id ? { ...i, discord_webhook_url: null } : i));
    } catch (e) {
      await showAlert(e.message || 'Failed to remove webhook');
    }
  };

  // Filter items that actually have a webhook
  const notifiedItems = items.filter(it => it.discord_webhook_url);

  return (
    <div className="dashboard-container" style={{ maxWidth: 720 }}>
      <h2 style={{ textAlign: 'center' }}>Account</h2>
      {user ? (
        <div style={{ textAlign: 'center' }}>
          <p>Logged in as <strong>{user.username}</strong></p>
          <p style={{ color:'#6b7280', fontSize:'0.85rem' }}>{user.email}</p>
          <button className="account-button header-bordered-button" onClick={logout} style={{ background: '#990101a2', fontWeight: 400 }}>Logout</button>

          <div style={{ marginTop: 40, textAlign: 'left' }}>
            <h3 style={{ textAlign: 'center' }}>CSFloat Integration</h3>
            <div className="account-csfloat-card" style={{ background: '#1c1c1c', padding: 20, borderRadius: 8, marginBottom: 30, border: '1px solid #333' }}>
                <p style={{ margin: '0 0 15px 0', fontSize: '0.9rem', color: '#888', lineHeight: 1.5 }}>
                  By default we are using our own CSFloat API Keys, but there are limitations to the requests. To avoid problems, please add your CSFloat API key from Developers tab. 
                  Your API Key is encrypted using <strong>AES-256-GCM</strong> before storage.
                </p>

                {csfloatKeySet ? (
                  <div className="account-csfloat-active-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(76, 175, 80, 0.1)', padding: 15, borderRadius: 6, border: '1px solid rgba(76, 175, 80, 0.3)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ background: '#4caf50', borderRadius: '50%', width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'black', fontWeight: 'bold' }}>✓</div>
                      <div>
                        <div style={{ fontWeight: 600, color: '#4caf50' }}>API Key Active</div>
                        <div style={{ fontSize: '0.8rem', color: '#aaa' }}>Ready for automated requests</div>
                      </div>
                    </div>
                    <button 
                      onClick={deleteCsfloatKey}
                      className="btn-danger"
                      style={{ background: 'transparent', color: '#ff4d4d', border: '1px solid #ff4d4d', padding: '6px 12px', borderRadius: 4, cursor: 'pointer', fontSize: '0.85rem' }}
                    >
                      Remove Key
                    </button>
                  </div>
                ) : (
                  <div>
                    {!showKeyInput ? (
                      <div style={{ display: 'flex', justifyContent: 'center' }}>
                        <button
                          className="account-button"
                          onClick={() => setShowKeyInput(true)}
                          style={{ border: '1px solid #3a3a3a', fontWeight: 400 }}
                        >
                          Add CSFloat API Key
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <div className="account-csfloat-input-row" style={{ display: 'flex', gap: 10 }}>
                          <input 
                            className="account-csfloat-input"
                            type="password" 
                            placeholder="Paste your API Key (e.g. HfcuMg...)"
                            value={csfloatKeyInput}
                            onChange={(e) => setCsfloatKeyInput(e.target.value)}
                            style={{ flex: 1, padding: '10px 12px', borderRadius: 6, border: '1px solid #444', background: '#0d1117', color: 'white' }}
                            autoFocus
                          />
                          <button 
                            className="account-button account-csfloat-action"
                            onClick={saveCsfloatKey}
                            style={{ background: '#238636', color: 'white', border: '1px solid #3a3a3a', padding: '10px 20px' }}
                            disabled={!csfloatKeyInput}
                          >
                            Encrypt & Save
                          </button>
                          <button 
                            className="account-button account-csfloat-action"
                            onClick={() => { setShowKeyInput(false); setCsfloatKeyInput(''); }}
                            style={{ background: '#333', color: '#ccc', border: '1px solid #3a3a3a', padding: '10px 15px' }}
                          >
                            Cancel
                          </button>
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#666' }}>
                            Keys are stored with a unique initialization vector (IV) and authentication tag.
                        </div>
                      </div>
                    )}
                  </div>
                )}
            </div>

            <h3 style={{ textAlign: 'center' }}>Notifications</h3>
            {loading && <p>Loading items...</p>}
            
            {!loading && !portfolioWebhook && notifiedItems.length === 0 && (
              <p style={{ opacity: 0.6, textAlign: 'center' }}>No active webhook notifications.</p>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 15 }}>
                {portfolioWebhook && (
                    <div className="stat-card" style={{ display: 'flex', alignItems: 'center', padding: '10px 15px', borderLeft: '4px solid #ffffff' }}>
                        {/* Image for Portfolio */}
                        <div style={{ marginRight: 15 }}>
                           <div style={{ width: 48, height: 48, background: '#333', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem' }}>
                             📊
                           </div>
                        </div>
                        
                        {/* Info */}
                        <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 600 }}>Complete Inventory</div>
                            <div style={{ fontSize: '0.8rem', opacity: 0.6, maxWidth: '300px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {portfolioWebhook}
                            </div>
                        </div>

                        {/* Remove Button */}
                        <button 
                            className="icon-btn" 
                            title="Remove Webhook" 
                            style={{ color: '#ff4d4d', padding: 8 }}
                            onClick={removePortfolioWebhook}
                        >
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="18" y1="6" x2="6" y2="18"></line>
                                <line x1="6" y1="6" x2="18" y2="18"></line>
                            </svg>
                        </button>
                    </div>
                )}

                {notifiedItems.map((it) => (
                    <div key={it.user_item_id} className="stat-card" style={{ display: 'flex', alignItems: 'center', padding: '10px 15px' ,  borderLeft: '4px solid #ffffff'}}>
                        {/* Image */}
                        <div style={{ marginRight: 15 }}>
                            {(() => {
                                const imgUrl = it.item?.image || getImage(it.slug, it.item?.name);
                                return imgUrl ? (
                                    <img src={imgUrl} alt={it.item?.name} style={{ width: 48, height: 48, objectFit: 'contain' }} />
                                ) : (
                                    <div style={{ width: 48, height: 48, background: '#333', borderRadius: 4 }}></div>
                                );
                            })()}
                        </div>
                        
                        {/* Info */}
                        <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 600 }}>{it.item?.name}</div>
                            <div style={{ fontSize: '0.8rem', opacity: 0.6, maxWidth: '300px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {it.discord_webhook_url}
                            </div>
                        </div>

                        {/* Remove Button (Cross) */}
                        <button 
                            className="icon-btn" 
                            title="Remove Webhook" 
                            style={{ color: '#ff4d4d', padding: 8 }}
                            onClick={() => removeWebhook(it)}
                        >
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="18" y1="6" x2="6" y2="18"></line>
                                <line x1="6" y1="6" x2="18" y2="18"></line>
                            </svg>
                        </button>
                    </div>
                ))}
            </div>
          </div>
        </div>
      ) : (
        <div style={{ textAlign: 'center' }}>
          <p>You are not logged in.</p>
        </div>
      )}
    </div>
  );
}
