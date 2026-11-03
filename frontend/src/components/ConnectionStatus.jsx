export default function ConnectionStatus({ loading, health, error }) {
  return (
    <div className="connection" role="status" aria-live="polite" aria-busy={loading}>
      {loading ? (
        <p>Checking backend connection…</p>
      ) : error ? (
        <>
          <p className="status error">Connection unavailable</p>
          <p>{error}</p>
        </>
      ) : health ? (
        <>
          <p className="status success">Backend connected</p>
          <p>{health.message}</p>
          <p className="database">MongoDB: <strong>{health.database}</strong></p>
        </>
      ) : null}
    </div>
  );
}
