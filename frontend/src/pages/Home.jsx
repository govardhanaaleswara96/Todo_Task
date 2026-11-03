import { useEffect, useState } from 'react';
import ConnectionStatus from '../components/ConnectionStatus.jsx';
import { getHealth } from '../services/api.js';

export default function Home() {
  const [loading, setLoading] = useState(true);
  const [health, setHealth] = useState(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    getHealth()
      .then((data) => { if (active) setHealth(data); })
      .catch((err) => {
        if (active) {
          setHealth(null);
          setError(err.response?.status === 503
            ? 'The backend is reachable, but MongoDB is disconnected. Check the backend terminal.'
            : 'Could not reach the backend. Check that it is running and VITE_API_URL is correct.');
        }
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [attempt]);

  return (
    <main className="container">
      <div className="brand"><span className="brand-icon" aria-hidden="true">✓</span> Todo</div>
      <section className="card">
        <span className="eyebrow">PHASE 01 · PROJECT SETUP</span>
        <h1>A fresh start for<br />your next task.</h1>
        <p className="intro">Your Todo app starts here. Check the connection between React, Express, and MongoDB.</p>
        <ConnectionStatus loading={loading} health={health} error={error} />
        <button disabled={loading} onClick={() => setAttempt((value) => value + 1)}>
          {loading ? 'Checking…' : 'Check connection again'}
        </button>
      </section>
      <p className="footer">React + Vite <span aria-hidden="true">/</span> Express <span aria-hidden="true">/</span> MongoDB</p>
    </main>
  );
}
