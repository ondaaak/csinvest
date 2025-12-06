import React from 'react';
import { useParams, Link } from 'react-router-dom';

const LABELS = {
  cases: 'Cases',
  collections: 'Collections',
  knives: 'Knives',
  gloves: 'Gloves',
  weapons: 'Weapons',
  agents: 'Agents',
  stickers: 'Stickers',
  charms: 'Charms',
  patches: 'Patches',
  pins: 'Pins',
  graffities: 'Graffities',
};

export default function SearchCategory() {
  const { category } = useParams();
  const title = LABELS[category] || category;

  return (
    <div className="dashboard-container">
      <h2 style={{ textAlign: 'center' }}>{title}</h2>
      <p style={{ textAlign: 'center', color: '#6b7280' }}>
        Listing and detail pages coming soon. Data will load from backend.
      </p>
      <div style={{ textAlign: 'center', marginTop: '16px' }}>
        <Link className="account-button" to="/search">Back to categories</Link>
      </div>
    </div>
  );
}
