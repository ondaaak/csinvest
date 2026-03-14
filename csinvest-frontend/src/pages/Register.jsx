import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

function EyeIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17.94 17.94A10.94 10.94 0 0 1 12 19c-7 0-11-7-11-7a21.77 21.77 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A10.93 10.93 0 0 1 12 5c7 0 11 7 11 7a21.7 21.7 0 0 1-4.17 5.19" />
      <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
      <path d="m1 1 22 22" />
    </svg>
  );
}

const passwordFieldWrapperStyle = {
  position: 'relative',
  marginTop: 6,
};

const passwordInputStyle = {
  width: '100%',
  paddingRight: 42,
};

const togglePasswordButtonStyle = {
  position: 'absolute',
  top: '50%',
  right: 10,
  transform: 'translateY(-50%)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 0,
  border: 'none',
  background: 'transparent',
  color: '#9ca3af',
  cursor: 'pointer',
};

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordRepeat, setPasswordRepeat] = useState('');
  const [error, setError] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (password !== passwordRepeat) {
      setError('Passwords do not match');
      return;
    }

    try {
      await register({ username, email, password });
      navigate('/');
    } catch (err) {
      setError(err.message || 'Registration failed');
    }
  };

  return (
    <div className="dashboard-container" style={{ maxWidth: 480 }}>
      <h2 style={{ textAlign: 'center' }}>Register</h2>
      <form onSubmit={onSubmit} className="login-form">
        <label style={{ marginBottom: 12, display: 'block' }}>
          Username
          <input 
            className="search-input" 
            value={username} 
            onChange={(e) => setUsername(e.target.value)} 
            style={{ marginTop: 6, width: '100%' }} 
            required 
          />
        </label>
        <label style={{ marginBottom: 12, display: 'block' }}>
          Email
          <input 
            type="email" 
            className="search-input" 
            value={email} 
            onChange={(e) => setEmail(e.target.value)} 
            style={{ marginTop: 6, width: '100%' }} 
            required 
          />
        </label>
        <label style={{ marginBottom: 12, display: 'block' }}>
          Password
          <div style={passwordFieldWrapperStyle}>
            <input 
              type={showPasswords ? 'text' : 'password'} 
              className="search-input" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              style={passwordInputStyle} 
              required 
            />
            <button
              type="button"
              onClick={() => setShowPasswords((current) => !current)}
              style={togglePasswordButtonStyle}
              aria-label={showPasswords ? 'Hide passwords' : 'Show passwords'}
            >
              {showPasswords ? <EyeOffIcon /> : <EyeIcon />}
            </button>
          </div>
        </label>
        <label style={{ marginBottom: 12, display: 'block' }}>
          Repeat Password
          <div style={passwordFieldWrapperStyle}>
            <input 
              type={showPasswords ? 'text' : 'password'} 
              className="search-input" 
              value={passwordRepeat} 
              onChange={(e) => setPasswordRepeat(e.target.value)} 
              style={passwordInputStyle} 
              required 
            />
            <button
              type="button"
              onClick={() => setShowPasswords((current) => !current)}
              style={togglePasswordButtonStyle}
              aria-label={showPasswords ? 'Hide passwords' : 'Show passwords'}
            >
              {showPasswords ? <EyeOffIcon /> : <EyeIcon />}
            </button>
          </div>
        </label>
        {error && <div style={{ color: 'var(--loss-color)', marginTop: 8 }}>{error}</div>}
        
        <div style={{ marginTop: 12, textAlign: 'center' }}>
          <button type="submit" className="account-button">Register</button>
        </div>
      </form>
      <p style={{ textAlign: 'center', marginTop: 16, color: '#6b7280' }}>
        Already have an account? <Link to="/login" style={{ color: 'white', textDecoration: 'none' }}>Login</Link>
      </p>
    </div>
  );
}
