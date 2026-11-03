import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import GoogleSignIn from './GoogleSignIn.jsx';
import { signInWithGoogle } from '../services/authService.js';

export default function AuthForm({ mode }) {
  const isSignup = mode === 'signup';
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const submitting = useRef(false);

  async function handleCredential(credential) {
    if (submitting.current) return;
    submitting.current = true;
    setLoading(true);
    setError('');
    try {
      if (!credential) throw new Error('Google did not return a sign-in token. Please try again.');
      await signInWithGoogle(credential);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || (err.response ? 'Sign-in failed. Please try again.'
        : err.message === 'Network Error' ? 'Cannot reach the backend. Check that it is running.' : err.message));
    } finally {
      submitting.current = false;
      setLoading(false);
    }
  }

  return (
    <main className="container auth-container">
      <Link to="/login" className="brand brand-link"><span className="brand-icon" aria-hidden="true">✓</span> Todo</Link>
      <section className="card auth-card" aria-labelledby="auth-title">
        <span className="eyebrow">A LITTLE ORDER, EVERY DAY</span>
        <h1 id="auth-title">{isSignup ? 'Make room for what matters.' : 'Welcome back.'}</h1>
        <p className="intro">{isSignup ? 'Create your Todo account with Google.' : 'Sign in with Google to pick up where you left off.'}</p>
        <GoogleSignIn isSignup={isSignup} onCredential={handleCredential} disabled={loading} />
        {loading && <p className="form-notice" role="status">Signing you in…</p>}
        {error && <p className="field-error" role="alert">{error}</p>}
        <p className="google-help">New here? Your account is created automatically the first time you sign in.</p>
        <p className="auth-switch">
          {isSignup ? 'Already have an account? ' : 'New to Todo? '}
          <Link to={isSignup ? '/login' : '/signup'}>{isSignup ? 'Log in' : 'Sign up'}</Link>
        </p>
      </section>
      <p className="footer"><Link to="/health">Check backend connection</Link></p>
    </main>
  );
}
