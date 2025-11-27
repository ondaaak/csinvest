import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const CATEGORIES = [
  { key: 'cases', label: 'Cases' },
  { key: 'collections', label: 'Collections' },
  { key: 'knives', label: 'Knives' },
  { key: 'gloves', label: 'Gloves' },
  { key: 'agents', label: 'Agents' },
  { key: 'stickers', label: 'Stickers' },
  { key: 'charms', label: 'Charms' },
  { key: 'patches', label: 'Patches' },
  { key: 'pins', label: 'Pins' },
  { key: 'graffities', label: 'Graffities' },
  { key: 'music-kits', label: 'Music kits' },
  { key: 'passes', label: 'Passes' },
  { key: 'medals', label: 'Medals' },
  { key: 'other', label: 'Other' },
];

function SearchPage() {
  const [query, setQuery] = useState('');
  const navigate = useNavigate();

  // Load category images from src/assets/search with common extensions.
  // Robust to naming like "music-kits.png", "music_kits.png", "MusicKits.png" etc.
  const normalize = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const glob = import.meta.glob('../assets/search/*.{png,jpg,jpeg,svg,webp}', { eager: true, query: '?url', import: 'default' });
  const imgMap = Object.fromEntries(
    Object.entries(glob).map(([p, url]) => {
      const filename = p.split('/').pop() || '';
      const keyRaw = filename.substring(0, filename.lastIndexOf('.'));
      return [normalize(keyRaw), url];
    })
  );

  const onCategoryClick = (cat) => {
    navigate(`/search/${cat.key}`);
  };

  return (
    <div className="dashboard-container">
      <h2 style={{ textAlign: 'center' }}>Search any skin</h2>

      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <input
          className="search-input"
          placeholder="Search..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className="categories-grid">
        {CATEGORIES.map((c) => {
          const keyNorm = normalize(c.key);
          // support a few aliases (e.g., graffiti vs graffities, musickits without hyphen)
          const aliases = [keyNorm];
          if (keyNorm === 'graffities') aliases.push('graffiti', 'graffitis');
          if (keyNorm === 'musickits') aliases.push('musickits', 'music_kits', 'musickit');
          let src = undefined;
          for (const k of aliases) { if (imgMap[k]) { src = imgMap[k]; break; } }
          return (
            <button key={c.key} className="category-card" onClick={() => onCategoryClick(c)}>
              {src ? (
                <img className="category-img" src={src} alt={c.label} />
              ) : (
                <div className="category-icon" aria-hidden="true"></div>
              )}
              <div className="category-label">{c.label}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default SearchPage;
