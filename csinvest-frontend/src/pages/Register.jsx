import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const res = await register({ username, email, password });
    if (res.ok) navigate('/');
    else setError(res.error || 'Registration failed');
  };

  return (
    <div className="dashboard-container" style={{ maxWidth: 480 }}>
      <h2 style={{ textAlign: 'center' }}>Register</h2>
      <form onSubmit={onSubmit} className="login-form">
        <label style={{ marginBottom: 12, display: 'block' }}>
          Username
          <input className="search-input" value={username} onChange={(e) => setUsername(e.target.value)} style={{ marginTop: 6, width: '100%' }} />
        </label>
        <label style={{ marginBottom: 12, display: 'block' }}>
          Email
          <input type="email" className="search-input" value={email} onChange={(e) => setEmail(e.target.value)} style={{ marginTop: 6, width: '100%' }} />
        </label>
        <label style={{ display: 'block' }}>
          Password
          <input type="password" className="search-input" value={password} onChange={(e) => setPassword(e.target.value)} style={{ marginTop: 6, width: '100%' }} />
        </label>
        {error && <div style={{ color: 'var(--loss-color)', marginTop: 8 }}>{error}</div>}
        <div style={{ marginTop: 12, textAlign:'center' }}>
          <button type="submit" className="account-button">Register</button>
        </div>
      </form>
      <p style={{ textAlign: 'center', marginTop: 16, color: '#6b7280' }}>
        Already have an account? <Link to="/login" style={{ color: 'white', textDecoration: 'none' }}>Login</Link>
      </p>
    </div>
  );
}
