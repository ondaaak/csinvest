import React from 'react';
import { useAuth } from '../auth/AuthContext.jsx';

export default function AccountPage() {
  const { user, logout } = useAuth();

  return (
    <div className="dashboard-container" style={{ maxWidth: 720 }}>
      <h2 style={{ textAlign: 'center' }}>Account</h2>
      {user ? (
        <div style={{ textAlign: 'center' }}>
          <p>Logged in as <strong>{user.username}</strong></p>
          <p style={{ color:'#6b7280', fontSize:'0.85rem' }}>{user.email}</p>
          <button className="account-button" onClick={logout}>Logout</button>
        </div>
      ) : (
        <div style={{ textAlign: 'center' }}>
          <p>You are not logged in.</p>
        </div>
      )}
    </div>
  );
}
