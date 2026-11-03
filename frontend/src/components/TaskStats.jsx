export default function TaskStats({ todos, loading = false }) {
  const completed = todos.filter((todo) => todo.status === 'Completed').length;
  const stats = [
    { label: 'Total Tasks', count: todos.length, symbol: '≡', style: 'total', detail: 'Everything on your list' },
    { label: 'Completed Tasks', count: completed, symbol: '✓', style: 'completed', detail: 'A little progress, every day' },
    { label: 'Pending Tasks', count: todos.length - completed, symbol: '◷', style: 'pending', detail: 'Ready when you are' },
  ];

  return (
    <section className="task-stats" aria-label="Task statistics" aria-busy={loading}>
      {stats.map((stat) => (
        <article key={stat.label} className={`stat-card stat-${stat.style}`}>
          <div className="stat-top"><h2>{stat.label}</h2><span className="stat-symbol" aria-hidden="true">{stat.symbol}</span></div>
          <p className="stat-count">{loading ? '—' : stat.count}</p>
          <p className="stat-detail">{stat.detail}</p>
        </article>
      ))}
    </section>
  );
}
