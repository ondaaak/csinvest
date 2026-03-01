import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const ok = await login({ username, password });
    if (ok) navigate('/');
    else setError('Invalid credentials');
  };

  return (
    <div className="dashboard-container" style={{ maxWidth: 480 }}>
      <h2 style={{ textAlign: 'center' }}>Login</h2>
      <form onSubmit={onSubmit} className="login-form">
        <label style={{ marginBottom: 12, display: 'block' }}>
          Username
          <input className="search-input" value={username} onChange={(e) => setUsername(e.target.value)} style={{ marginTop: 6, width: '100%' }} />
        </label>
        <label style={{ display: 'block' }}>
          Password
          <input type="password" className="search-input" value={password} onChange={(e) => setPassword(e.target.value)} style={{ marginTop: 6, width: '100%' }} />
        </label>
        {error && <div style={{ color: 'var(--loss-color)', marginTop: 8 }}>{error}</div>}
        <div style={{ marginTop: 12, textAlign:'center' }}>
          <button type="submit" className="account-button">Login</button>
        </div>
      </form>
      <p style={{ textAlign: 'center', marginTop: 16, color: '#6b7280' }}>
        Need an account? <Link to="/register" style={{ color: 'white', textDecoration: 'none' }}>Register</Link>
      </p>
    </div>
  );
}
