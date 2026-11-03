const dateFormatter = new Intl.DateTimeFormat(undefined, {
  year: 'numeric', month: 'short', day: 'numeric',
});

export default function TodoTable({ todos, onAdd, onEdit, onDelete, onStatusChange, disabled, busy }) {
  if (!todos.length) {
    return (
      <div className="empty-todos">
        <span className="empty-icon" aria-hidden="true">✓</span>
        <h3>A little space for something new.</h3>
        <p>No tasks yet. Add your first todo to get started.</p>
        <button onClick={onAdd} disabled={disabled}>Add your first Todo</button>
      </div>
    );
  }

  return (
    <div className="todo-table-scroll" role="region" aria-label="Todo list, scroll horizontally on small screens" tabIndex={0}>
      <table className="todo-table">
        <caption className="sr-only">Your todos, including status, creation date, and edit or delete actions.</caption>
        <thead><tr>{['ID', 'Title', 'Description', 'Status', 'Created Date', 'Actions'].map((label) => <th key={label} scope="col">{label}</th>)}</tr></thead>
        <tbody>
          {todos.map((todo) => (
            <tr key={todo._id} aria-busy={busy?.id === todo._id}>
              <td className="todo-id"><code>{todo._id}</code></td>
              <th scope="row" className="todo-title">{todo.title}</th>
              <td className="todo-description">{todo.description || '—'}</td>
              <td>
                <select className={`todo-status-select ${todo.status === 'Completed' ? 'badge-completed' : 'badge-pending'}`}
                  aria-label={`Status for ${todo.title}`} value={todo.status} disabled={disabled}
                  onChange={(event) => onStatusChange(todo, event.target.value)}>
                  <option>Pending</option><option>Completed</option>
                </select>
                {busy?.id === todo._id && busy.action === 'status' && <span className="row-progress" role="status">Updating…</span>}
              </td>
              <td className="todo-date"><time dateTime={todo.createdAt}>{dateFormatter.format(new Date(todo.createdAt))}</time></td>
              <td><div className="row-actions">
                <button className="button-secondary button-small" onClick={() => onEdit(todo)} disabled={disabled} aria-label={`Edit ${todo.title}`}>Edit</button>
                <button className="button-delete button-small" onClick={() => onDelete(todo)} disabled={disabled} aria-label={`Delete ${todo.title}`}>{busy?.id === todo._id && busy.action === 'delete' ? 'Deleting…' : 'Delete'}</button>
              </div></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
