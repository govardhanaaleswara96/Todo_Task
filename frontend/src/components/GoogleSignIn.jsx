import { useEffect, useRef, useState } from 'react';

let scriptPromise;
function loadGoogle() {
  if (window.google?.accounts?.id) return Promise.resolve(window.google);
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.onload = () => window.google?.accounts?.id
        ? resolve(window.google) : reject(new Error('Google sign-in did not load.'));
      script.onerror = () => { script.remove(); reject(new Error('Could not load Google sign-in. Check your connection or browser settings.')); };
      document.head.appendChild(script);
    }).catch((error) => { scriptPromise = undefined; throw error; });
  }
  return scriptPromise;
}

export default function GoogleSignIn({ isSignup, onCredential, disabled }) {
  const container = useRef(null);
  const callbackRef = useRef(onCredential);
  const disabledRef = useRef(disabled);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  callbackRef.current = onCredential;
  disabledRef.current = disabled;

  useEffect(() => {
    if (!clientId) { setLoading(false); return; }
    let active = true;
    loadGoogle().then((google) => {
      if (!active || !container.current) return;
      google.accounts.id.initialize({
        client_id: clientId,
        auto_select: false,
        callback: (response) => {
          if (active && !disabledRef.current) callbackRef.current(response.credential);
        },
      });
      google.accounts.id.renderButton(container.current, {
        theme: 'outline', size: 'large', type: 'standard',
        text: isSignup ? 'signup_with' : 'signin_with',
        width: Math.min(360, container.current.clientWidth),
      });
      setLoading(false);
    }).catch((err) => { if (active) { setError(err.message); setLoading(false); } });
    return () => { active = false; };
  }, [clientId, isSignup]);

  if (!clientId) {
    return <p className="form-notice" role="status">Google sign-in needs configuration. Set VITE_GOOGLE_CLIENT_ID in frontend/.env and GOOGLE_CLIENT_ID in backend/.env, then restart both servers.</p>;
  }
  return (
    <div>
      {loading && <p role="status">Loading Google sign-in…</p>}
      {error && <p className="field-error" role="alert">{error}</p>}
      <div ref={container} className="google-signin" inert={disabled ? '' : undefined} aria-busy={disabled} />
    </div>
  );
}
