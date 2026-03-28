import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

const API_BASE = '/api';

function parseApiError(data, fallbackMessage) {
  const detail = data?.detail;
  if (!detail) return fallbackMessage;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    const joined = detail
      .map((item) => {
        if (typeof item === 'string') return item;
        if (item?.msg) return item.msg;
        return null;
      })
      .filter(Boolean)
      .join(', ');
    return joined || fallbackMessage;
  }
  if (typeof detail === 'object') {
    return detail.message || fallbackMessage;
  }
  return fallbackMessage;
}

export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const canSubmitReset = useMemo(() => {
    return email.trim() && code.trim() && newPassword.trim() && confirmPassword.trim();
  }, [email, code, newPassword, confirmPassword]);

  const requestCode = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/auth/password-reset/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(parseApiError(data, 'Failed to request reset code'));
      }

      setMessage('Reset code was sent to your email.');
      setStep(2);
    } catch (err) {
      setError(err.message || 'Failed to request reset code');
    } finally {
      setLoading(false);
    }
  };

  const verifyCode = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/auth/password-reset/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          code: code.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(parseApiError(data, 'Invalid code'));
      }

      setStep(3);
      setMessage('Code verified. Enter your new password.');
    } catch (err) {
      setError(err.message || 'Invalid code');
    } finally {
      setLoading(false);
    }
  };

  const completeReset = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (newPassword.length < 8) {
      setError('Password must have at least 8 characters');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/password-reset/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          code: code.trim(),
          new_password: newPassword,
          confirm_password: confirmPassword,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(parseApiError(data, 'Failed to reset password'));
      }

      setMessage('Password changed successfully. Redirecting to login...');
      setTimeout(() => navigate('/login'), 1200);
    } catch (err) {
      setError(err.message || 'Failed to reset password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="dashboard-container" style={{ maxWidth: 520 }}>
      <h2 style={{ textAlign: 'center' }}>Reset Password</h2>

      {step === 1 && (
        <form onSubmit={requestCode} className="login-form">
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
          <div style={{ marginTop: 12, textAlign: 'center' }}>
            <button type="submit" className="account-button" disabled={loading}>
              {loading ? 'Sending...' : 'Send reset code'}
            </button>
          </div>
        </form>
      )}

      {step === 2 && (
        <form onSubmit={verifyCode} className="login-form">
          <label style={{ marginBottom: 12, display: 'block' }}>
            Reset Code
            <input
              className="search-input"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              style={{ marginTop: 6, width: '100%', textTransform: 'uppercase' }}
              placeholder="Enter code from email"
              required
            />
          </label>
          <div style={{ marginTop: 12, textAlign: 'center' }}>
            <button type="submit" className="account-button" disabled={loading}>
              {loading ? 'Verifying...' : 'Verify code'}
            </button>
          </div>
        </form>
      )}

      {step === 3 && (
        <form onSubmit={completeReset} className="login-form">
          <label style={{ marginBottom: 12, display: 'block' }}>
            New Password
            <input
              type="password"
              className="search-input"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              style={{ marginTop: 6, width: '100%' }}
              minLength={8}
              required
            />
          </label>
          <label style={{ marginBottom: 12, display: 'block' }}>
            Confirm New Password
            <input
              type="password"
              className="search-input"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              style={{ marginTop: 6, width: '100%' }}
              minLength={8}
              required
            />
          </label>
          <div style={{ marginTop: 12, textAlign: 'center' }}>
            <button type="submit" className="account-button" disabled={loading || !canSubmitReset}>
              {loading ? 'Resetting...' : 'Set new password'}
            </button>
          </div>
        </form>
      )}

      {error && <div style={{ color: 'var(--loss-color)', marginTop: 12, textAlign: 'center' }}>{error}</div>}
      {message && <div style={{ color: 'var(--profit-color)', marginTop: 12, textAlign: 'center' }}>{message}</div>}

      <p style={{ textAlign: 'center', marginTop: 16, color: '#6b7280' }}>
        Back to <Link to="/login" style={{ color: 'white', textDecoration: 'none' }}>Login</Link>
      </p>
    </div>
  );
}
