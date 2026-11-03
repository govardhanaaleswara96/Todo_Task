# Dashboard Todo API integration — complete source

These files connect the existing Google-protected dashboard to the actual Todo backend. The existing credentialed Axios instance (`src/services/api.js`) is reused. No authentication, backend API, dependency, or environment changes were needed. The former `frontend/src/data/sampleTodos.js` file was deleted; it is not replaced with fallback data.

See [README.md](README.md#dashboard-connected-to-mongodb) for running and verification instructions.

## frontend/src/services/todoService.js

```javascript
import api from './api.js';

export async function getTodos(signal) {
  return (await api.get('/todos', { signal })).data.todos;
}

export async function createTodo(values) {
  return (await api.post('/todos', values)).data.todo;
}

export async function updateTodo(id, values) {
  return (await api.put(`/todos/${id}`, values)).data.todo;
}

export async function deleteTodo(id) {
  // DELETE returns HTTP 204 with no JSON body.
  await api.delete(`/todos/${id}`);
}

export function todoErrorMessage(error, fallback) {
  if (!error.response) {
    return error.code === 'ECONNABORTED'
      ? 'The request timed out. Refresh the list before retrying; the change may have reached the server.'
      : 'Cannot reach the backend. Check your connection and refresh the list before retrying.';
  }
  const fields = error.response.data?.errors;
  if (fields && typeof fields === 'object') return Object.values(fields).join(' ');
  return error.response.data?.message || fallback;
}
```

## frontend/src/pages/Dashboard.jsx

```jsx
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getProfile, signOut } from '../services/authService.js';
import { getTodos, createTodo, updateTodo, deleteTodo, todoErrorMessage } from '../services/todoService.js';
import TaskStats from '../components/TaskStats.jsx';
import TodoTable from '../components/TodoTable.jsx';
import TodoModal from '../components/TodoModal.jsx';

export default function Dashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [profileError, setProfileError] = useState('');
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [profileAttempt, setProfileAttempt] = useState(0);
  const [todos, setTodos] = useState([]);
  const [loadingTodos, setLoadingTodos] = useState(true);
  const [listError, setListError] = useState('');
  const [listAttempt, setListAttempt] = useState(0);
  const [modal, setModal] = useState(null);
  const [saveError, setSaveError] = useState('');
  const [notification, setNotification] = useState(null);
  const [busy, setBusy] = useState(null);
  const [signingOut, setSigningOut] = useState(false);
  // Synchronous lock prevents duplicate submissions before React rerenders.
  const mutationInFlight = useRef(false);

  useEffect(() => {
    let active = true;
    setLoadingProfile(true);
    setProfileError('');
    getProfile().then((profile) => { if (active) setUser(profile); })
      .catch((error) => {
        if (!active) return;
        if (error.response?.status === 401) navigate('/login', { replace: true });
        else setProfileError('Could not load your profile. Check the backend connection and retry.');
      }).finally(() => { if (active) setLoadingProfile(false); });
    return () => { active = false; };
  }, [navigate, profileAttempt]);

  useEffect(() => {
    if (!user) return;
    const controller = new AbortController();
    let active = true;
    setLoadingTodos(true);
    setListError('');
    getTodos(controller.signal).then((items) => { if (active) setTodos(items); })
      .catch((error) => {
        if (!active) return;
        if (error.response?.status === 401) navigate('/login', { replace: true });
        else setListError(todoErrorMessage(error, 'Could not load your todos.'));
      }).finally(() => { if (active) setLoadingTodos(false); });
    return () => { active = false; controller.abort(); };
  }, [user, listAttempt, navigate]);

  function handleAuthFailure(error) {
    if (error.response?.status === 401) {
      navigate('/login', { replace: true });
      return true;
    }
    return false;
  }

  async function handleLogout() {
    if (mutationInFlight.current) return;
    mutationInFlight.current = true;
    setSigningOut(true);
    setNotification(null);
    try {
      await signOut();
      window.google?.accounts?.id?.disableAutoSelect();
      navigate('/login', { replace: true });
    } catch (error) {
      if (!handleAuthFailure(error)) setNotification({ type: 'error', message: 'Could not sign out. Please try again.' });
    } finally {
      mutationInFlight.current = false;
      setSigningOut(false);
    }
  }

  function openModal(todo = null) {
    setSaveError('');
    setNotification(null);
    setModal({ todo });
  }

  async function saveTodo(values) {
    if (mutationInFlight.current) return;
    mutationInFlight.current = true;
    setBusy({ action: 'save' });
    setSaveError('');
    setNotification(null);
    try {
      const saved = modal.todo
        ? await updateTodo(modal.todo._id, values)
        : await createTodo(values);
      // Update the UI only after MongoDB confirms the change.
      setTodos((current) => modal.todo
        ? current.map((todo) => todo._id === saved._id ? saved : todo)
        : [saved, ...current]);
      setNotification({ type: 'success', message: modal.todo ? 'Todo updated.' : 'Todo created.' });
      setModal(null);
    } catch (error) {
      if (!handleAuthFailure(error)) setSaveError(todoErrorMessage(error, 'Could not save the Todo.'));
      // Keep the modal and entered values open when a request fails.
    } finally {
      mutationInFlight.current = false;
      setBusy(null);
    }
  }

  async function handleDelete(todo) {
    if (mutationInFlight.current || !window.confirm(`Delete “${todo.title}”? This cannot be undone.`)) return;
    mutationInFlight.current = true;
    setBusy({ action: 'delete', id: todo._id });
    setNotification(null);
    try {
      await deleteTodo(todo._id);
      setTodos((current) => current.filter((item) => item._id !== todo._id));
      setNotification({ type: 'success', message: 'Todo deleted.' });
    } catch (error) {
      if (!handleAuthFailure(error)) setNotification({ type: 'error', message: todoErrorMessage(error, 'Could not delete the Todo.') });
    } finally {
      mutationInFlight.current = false;
      setBusy(null);
    }
  }

  async function handleStatusChange(todo, status) {
    if (mutationInFlight.current || status === todo.status) return;
    mutationInFlight.current = true;
    setBusy({ action: 'status', id: todo._id });
    setNotification(null);
    try {
      const updated = await updateTodo(todo._id, { status });
      setTodos((current) => current.map((item) => item._id === updated._id ? updated : item));
      setNotification({ type: 'success', message: `Todo marked ${updated.status.toLowerCase()}.` });
    } catch (error) {
      if (!handleAuthFailure(error)) setNotification({ type: 'error', message: todoErrorMessage(error, 'Could not update status.') });
    } finally {
      mutationInFlight.current = false;
      setBusy(null);
    }
  }

  const disabled = Boolean(busy) || signingOut || loadingTodos;
  return (
    <main className="container dashboard-container">
      <header className="dashboard-nav">
        <Link to="/dashboard" className="brand brand-link"><span className="brand-icon" aria-hidden="true">✓</span> Todo</Link>
        {user && <div className="dashboard-account"><span className="account-email">{user.email}</span><button className="button-secondary" onClick={handleLogout} disabled={Boolean(busy) || signingOut}>{signingOut ? 'Signing out…' : 'Log out'}</button></div>}
      </header>
      {loadingProfile ? (
        <section className="card dashboard-loading" role="status" aria-busy="true"><span className="loading-spinner" aria-hidden="true" /><h1>Loading your workspace…</h1><p>Checking your session and getting things ready.</p></section>
      ) : !user ? (
        <section className="card"><h1>Let’s reconnect.</h1><p className="field-error" role="alert">{profileError}</p><button onClick={() => setProfileAttempt((value) => value + 1)}>Retry loading profile</button></section>
      ) : (
        <>
          <section className="dashboard-welcome"><span className="eyebrow">YOUR WORKSPACE</span><h1>Welcome, {user.name}.</h1><p>A little focus. A little progress. One task at a time.</p></section>
          <TaskStats todos={todos} loading={loadingTodos || Boolean(listError)} />
          {notification && <div className={`todo-notification notification-${notification.type}`} role={notification.type === 'error' ? 'alert' : 'status'}><span>{notification.message}</span><button className="notification-dismiss" onClick={() => setNotification(null)} aria-label="Dismiss notification">×</button></div>}
          <section className="todo-panel" aria-labelledby="todos-heading">
            <div className="todo-panel-heading"><div><h2 id="todos-heading">Your todos</h2><p>{loadingTodos ? 'Loading your tasks…' : listError ? 'Your tasks are unavailable' : `${todos.length} ${todos.length === 1 ? 'task' : 'tasks'} on your list`}</p></div><div className="todo-toolbar"><button className="button-secondary" onClick={() => { setNotification(null); setListAttempt((value) => value + 1); }} disabled={disabled}>Refresh</button><button onClick={() => openModal()} disabled={disabled || Boolean(listError)}><span aria-hidden="true">+ </span>Add Todo</button></div></div>
            {loadingTodos ? <div className="todo-list-feedback" role="status" aria-busy="true"><span className="loading-spinner" aria-hidden="true" /><p>Loading your todos…</p></div>
              : listError ? <div className="todo-list-feedback"><p className="field-error" role="alert">{listError}</p><button onClick={() => setListAttempt((value) => value + 1)}>Retry loading todos</button></div>
              : <TodoTable todos={todos} onAdd={() => openModal()} onEdit={openModal} onDelete={handleDelete} onStatusChange={handleStatusChange} disabled={disabled} busy={busy} />}
          </section>
          {modal && <TodoModal todo={modal.todo} onSave={saveTodo} onClose={() => { if (!mutationInFlight.current) setModal(null); }} saving={busy?.action === 'save'} serverError={saveError} />}
        </>
      )}
      <p className="footer"><Link to="/health">Check backend connection</Link></p>
    </main>
  );
}
```

## frontend/src/components/TodoTable.jsx

```jsx
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
```

## frontend/src/components/TodoModal.jsx

```jsx
import { useEffect, useRef, useState } from 'react';

export default function TodoModal({ todo, onSave, onClose, saving, serverError }) {
  const dialog = useRef(null);
  const [title, setTitle] = useState(todo?.title || '');
  const [description, setDescription] = useState(todo?.description || '');
  const [status, setStatus] = useState(todo?.status || 'Pending');
  const [error, setError] = useState('');

  useEffect(() => {
    const element = dialog.current;
    element.showModal();
    return () => element.close();
  }, []);

  function handleSubmit(event) {
    event.preventDefault();
    if (saving) return;
    if (!title.trim()) {
      setError('Enter a title for your todo.');
      event.currentTarget.elements.namedItem('title').focus();
      return;
    }
    onSave({ title: title.trim(), description: description.trim(), status });
  }

  return (
    <dialog ref={dialog} className="todo-dialog" aria-labelledby="todo-dialog-title" aria-busy={saving}
      onCancel={(event) => { event.preventDefault(); if (!saving) onClose(); }}>
      <div className="dialog-heading">
        <h2 id="todo-dialog-title">{todo ? 'Edit Todo' : 'Add Todo'}</h2>
        <button className="button-secondary close-dialog" onClick={onClose} disabled={saving} aria-label="Close dialog">×</button>
      </div>
      <p className="dialog-note">Your changes are saved to your account.</p>
      <form onSubmit={handleSubmit}>
        <fieldset className="todo-form-fields" disabled={saving}>
          <div className="form-field">
            <label htmlFor="todo-title">Title <span className="required-note">(required)</span></label>
            <input id="todo-title" name="title" value={title} onChange={(event) => { setTitle(event.target.value); setError(''); }}
              maxLength={120} required autoFocus aria-invalid={Boolean(error)} aria-describedby={error ? 'todo-title-error' : undefined} />
            {error && <p className="field-error" id="todo-title-error">{error}</p>}
          </div>
          <div className="form-field">
            <label htmlFor="todo-description">Description</label>
            <textarea id="todo-description" value={description} onChange={(event) => setDescription(event.target.value)} maxLength={1000} rows={4} />
          </div>
          <div className="form-field">
            <label htmlFor="todo-status">Status</label>
            <select id="todo-status" value={status} onChange={(event) => setStatus(event.target.value)}><option>Pending</option><option>Completed</option></select>
          </div>
        </fieldset>
        {serverError && <p className="field-error save-error" role="alert">{serverError}</p>}
        {saving && <p role="status" className="dialog-note">Saving your Todo…</p>}
        <div className="dialog-actions">
          <button type="button" className="button-secondary" onClick={onClose} disabled={saving}>Cancel</button>
          <button type="submit" disabled={saving}>{saving ? 'Saving…' : todo ? 'Save changes' : 'Add Todo'}</button>
        </div>
      </form>
    </dialog>
  );
}
```

## frontend/src/components/TaskStats.jsx

```jsx
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
```

## frontend/src/App.css

```css
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap');

:root { font-family: 'DM Sans', system-ui, sans-serif; color: #1e312d; background: #f3f5f0; font-synthesis: none; }
* { box-sizing: border-box; }
body { margin: 0; }
.container { max-width: 700px; margin: 0 auto; padding: 48px 24px; }
.brand { display: flex; align-items: center; gap: 10px; font-size: 24px; font-weight: 700; margin-bottom: 40px; }
.brand-icon { background: #205d48; color: white; border-radius: 10px; width: 34px; height: 34px; text-align: center; }
.card { background: white; border: 1px solid #dce3da; border-radius: 20px; padding: 48px; box-shadow: 0 16px 50px #213e2b08; }
.eyebrow { color: #587565; font-size: 11px; letter-spacing: 2px; font-weight: 700; }
h1 { font-size: clamp(32px, 6vw, 46px); line-height: 1.15; letter-spacing: -1.5px; margin: 24px 0 18px; }
p { line-height: 1.65; }
.intro { color: #68746c; margin-bottom: 30px; }
.connection { background: #f7f9f5; border: 1px solid #e1e8dd; border-radius: 12px; padding: 20px; margin-bottom: 24px; min-height: 150px; }
.connection p { margin: 0 0 8px; font-size: 14px; }
.connection p:last-child { margin-bottom: 0; }
.status { font-weight: 700; }
.success { color: #226c49; }
.error { color: #a13030; }
.database { color: #526451; }
button { background: #205d48; color: white; border: 0; border-radius: 9px; padding: 14px 20px; cursor: pointer; font: inherit; font-size: 14px; font-weight: 600; }
button:hover { background: #164b38; }
button:focus-visible { outline: 3px solid #7eb799; outline-offset: 4px; }
button:disabled { opacity: .65; cursor: wait; }
.footer { text-align: center; color: #748074; font-size: 12px; margin-top: 24px; }
.footer span { padding: 0 12px; color: #b0b9ad; }
@media (max-width: 480px) { .container { padding: 28px 16px; } .card { padding: 28px 24px; } .brand { margin-bottom: 28px; } button { width: 100%; } }

/* Signup and login pages share the Phase 1 visual style. */
a { color: #205d48; text-underline-offset: 3px; }
a:focus-visible { outline: 3px solid #7eb799; outline-offset: 4px; border-radius: 3px; }
.brand-link { color: inherit; text-decoration: none; width: fit-content; }
.auth-container { max-width: 560px; padding-top: 32px; }
.auth-container .brand { margin-bottom: 24px; }
.auth-card h1 { font-size: clamp(30px, 6vw, 38px); margin: 18px 0 12px; }
.auth-card .intro { margin: 0 0 18px; font-size: 14px; }
.preview-note { font-size: 12px; line-height: 1.5; background: #f3f5f0; border-radius: 8px; padding: 10px 12px; color: #526451; margin: 0 0 24px; }
.form-field { margin-bottom: 18px; }
.form-field label { display: block; font-size: 13px; font-weight: 600; margin-bottom: 7px; }
.form-field input { width: 100%; border: 1px solid #cbd5cb; border-radius: 8px; padding: 12px 14px; color: #1e312d; background: #fff; font: inherit; font-size: 16px; }
.form-field input::placeholder { color: #778277; }
.form-field input:focus { outline: 2px solid #7eb799; outline-offset: 1px; border-color: #205d48; }
.form-field input[aria-invalid="true"] { border-color: #a13030; }
.field-error { color: #a13030; font-size: 12px; margin: 6px 0 0; }
.full-width { width: 100%; }
.divider { display: flex; align-items: center; gap: 14px; color: #748074; font-size: 12px; margin: 20px 0; }
.divider::before, .divider::after { content: ''; flex: 1; height: 1px; background: #e1e8dd; }
.google-button { display: flex; align-items: center; justify-content: center; gap: 12px; color: #263b31; background: white; border: 1px solid #cbd5cb; }
.google-button:hover { background: #f3f5f0; }
.google-mark { font-size: 18px; font-weight: 700; }
.auth-switch { font-size: 13px; text-align: center; margin: 24px 0 0; color: #68746c; }
.auth-switch a { font-weight: 700; }
.form-notice { border: 1px solid #cbd5cb; background: #f3f5f0; color: #334d3e; border-radius: 8px; padding: 12px; font-size: 13px; margin: 18px 0 0; }

.google-signin { width: 100%; min-height: 44px; display: flex; justify-content: center; }
.google-signin[inert] { opacity: .6; }
.google-help { font-size: 13px; color: #68746c; margin-top: 24px; }
.card strong { overflow-wrap: anywhere; }

/* Protected dashboard with server-backed Todos. */
.dashboard-container { max-width: 1240px; padding-top: 28px; }
.dashboard-nav { display: flex; align-items: center; justify-content: space-between; gap: 20px; padding-bottom: 24px; border-bottom: 1px solid #dce3da; }
.dashboard-nav .brand { margin: 0; }
.dashboard-account { display: flex; align-items: center; gap: 20px; min-width: 0; }
.account-email { color: #68746c; font-size: 13px; overflow-wrap: anywhere; }
.button-secondary { background: #fff; border: 1px solid #cbd5cb; color: #205d48; }
.button-secondary:hover { background: #eaf0e7; }
.dashboard-welcome { margin: 40px 0 28px; }
.dashboard-welcome h1 { font-size: clamp(28px, 4vw, 38px); margin: 12px 0; overflow-wrap: anywhere; }
.dashboard-welcome p { margin: 0; color: #68746c; }
.task-stats { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 20px; margin-bottom: 24px; }
.stat-card { background: #fff; border: 1px solid #dce3da; padding: 24px; border-radius: 14px; }
.stat-top { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.stat-top h2 { font-size: 14px; font-weight: 500; margin: 0; color: #526451; }
.stat-symbol { display: grid; place-items: center; width: 34px; height: 34px; background: #edf1e9; border-radius: 9px; font-size: 22px; color: #526451; }
.stat-completed .stat-symbol { background: #e6f4eb; color: #226c49; }
.stat-pending .stat-symbol { background: #fff3dc; color: #8b611a; }
.stat-count { font-size: 38px; line-height: 1; font-weight: 700; margin: 18px 0 12px; }
.stat-detail { font-size: 12px; margin: 0; color: #748074; }
.todo-panel { border: 1px solid #dce3da; background: #fff; border-radius: 16px; overflow: hidden; }
.todo-panel-heading { padding: 24px; display: flex; justify-content: space-between; align-items: center; gap: 20px; }
.todo-panel-heading h2 { margin: 0; font-size: 20px; }
.todo-panel-heading p { margin: 4px 0 0; font-size: 12px; color: #748074; }
.todo-table-scroll { overflow-x: auto; }
.todo-table-scroll:focus-visible { outline: 2px solid #7eb799; outline-offset: -3px; }
.todo-table { border-collapse: collapse; width: 100%; min-width: 880px; text-align: left; font-size: 13px; }
.todo-table thead { background: #f7f9f5; color: #68746c; }
.todo-table th, .todo-table td { padding: 18px 20px; border-top: 1px solid #e7ece3; vertical-align: middle; }
.todo-table thead th { font-size: 11px; font-weight: 600; letter-spacing: .3px; white-space: nowrap; }
.todo-table tbody tr:hover { background: #fafcf8; }
.todo-id { color: #879183; font-size: 12px; }
.todo-title { font-weight: 600; min-width: 160px; max-width: 240px; overflow-wrap: anywhere; }
.todo-description { color: #748074; min-width: 180px; max-width: 280px; line-height: 1.65; overflow-wrap: anywhere; }
.todo-date { white-space: nowrap; color: #68746c; font-size: 12px; }
.status-badge { display: inline-flex; align-items: center; gap: 5px; padding: 5px 9px; border-radius: 20px; font-size: 11px; font-weight: 600; white-space: nowrap; }
.badge-completed { color: #226c49; background: #e9f5ed; }
.badge-pending { color: #8b611a; background: #fff4de; }
.row-actions { display: flex; gap: 7px; }
.button-small { padding: 8px 11px; font-size: 12px; }
.button-delete { background: #fff; border: 1px solid #ead5d1; color: #a13030; }
.button-delete:hover { background: #fff0ed; }
.empty-todos { padding: 48px 24px; border-top: 1px solid #e7ece3; text-align: center; }
.empty-icon { display: inline-grid; place-items: center; width: 52px; height: 52px; background: #edf2e9; color: #587565; font-size: 26px; border-radius: 50%; }
.empty-todos h3 { font-size: 20px; margin: 20px 0 8px; }
.empty-todos p { color: #748074; font-size: 14px; margin-bottom: 24px; }
.dashboard-loading { text-align: center; margin-top: 40px; }
.dashboard-loading h1 { font-size: 26px; }
.dashboard-loading p { color: #748074; }
.loading-spinner { display: inline-block; width: 30px; height: 30px; border: 3px solid #dce3da; border-top-color: #205d48; border-radius: 50%; animation: todo-spin 1s linear infinite; }
@keyframes todo-spin { to { transform: rotate(360deg); } }
@media (prefers-reduced-motion: reduce) { .loading-spinner { animation: none; } }
.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; border: 0; }
.todo-dialog { border: 1px solid #dce3da; border-radius: 16px; padding: 28px; width: min(520px, calc(100% - 32px)); max-height: calc(100dvh - 48px); color: #1e312d; font-family: inherit; box-shadow: 0 20px 80px #142f2830; }
.todo-dialog::backdrop { background: #152b2366; }
.dialog-heading { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.dialog-heading h2 { margin: 0; font-size: 22px; }
.close-dialog { font-size: 22px; padding: 2px 10px; width: auto; }
.dialog-note { font-size: 12px; color: #748074; margin-bottom: 24px; }
.required-note { font-weight: 400; color: #748074; }
.form-field textarea, .form-field select { width: 100%; border: 1px solid #cbd5cb; border-radius: 8px; padding: 12px 14px; color: #1e312d; background: #fff; font: inherit; font-size: 16px; }
.form-field textarea { resize: vertical; }
.form-field textarea:focus, .form-field select:focus { outline: 2px solid #7eb799; outline-offset: 1px; border-color: #205d48; }
.dialog-actions { display: flex; justify-content: flex-end; gap: 12px; margin-top: 24px; }
@media (max-width: 760px) { .task-stats { gap: 12px; } .stat-card { padding: 18px; } .stat-detail { display: none; } .stat-top { align-items: flex-start; } .stat-top h2 { line-height: 1.5; } .account-email { max-width: 180px; } }
@media (max-width: 540px) {
  .dashboard-container { padding: 20px 16px; }
  .dashboard-nav { gap: 12px; }
  .dashboard-account { gap: 8px; }
  .account-email { display: none; }
  .dashboard-nav button { width: auto; padding: 10px 14px; }
  .dashboard-welcome { margin-top: 28px; }
  .task-stats { grid-template-columns: 1fr; gap: 10px; }
  .stat-card { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 16px 20px; }
  .stat-top { flex-direction: row-reverse; align-items: center; justify-content: flex-end; }
  .stat-count { font-size: 28px; margin: 0; }
  .todo-panel-heading { padding: 20px 16px; gap: 10px; }
  .todo-panel-heading button { width: auto; padding: 12px 14px; }
  .row-actions button { width: auto; }
  .dialog-actions button { flex: 1; }
}

.todo-toolbar { display: flex; gap: 10px; }
.todo-form-fields { border: 0; margin: 0; padding: 0; min-width: 0; }
.todo-list-feedback { text-align: center; padding: 40px 24px; border-top: 1px solid #e7ece3; color: #68746c; }
.todo-notification { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 14px 18px; border: 1px solid; border-radius: 10px; margin: 0 0 20px; font-size: 13px; }
.notification-success { color: #226c49; background: #e9f5ed; border-color: #c9e4d2; }
.notification-error { color: #a13030; background: #fff0ed; border-color: #ead5d1; }
.notification-dismiss { width: auto; padding: 0 4px; background: transparent; color: inherit; font-size: 22px; flex-shrink: 0; }
.notification-dismiss:hover { background: transparent; }
.todo-status-select { border: 1px solid transparent; border-radius: 8px; font-family: inherit; font-size: 12px; padding: 7px 8px; cursor: pointer; min-width: 112px; }
.todo-status-select:focus-visible { outline: 2px solid #7eb799; outline-offset: 2px; }
.todo-status-select:disabled { opacity: .65; cursor: wait; }
.row-progress { display: block; margin-top: 5px; font-size: 11px; color: #68746c; }
.todo-id code { font-size: 10px; }
.todo-table { min-width: 1020px; }
@media (max-width: 540px) { .todo-panel-heading { flex-wrap: wrap; } .todo-toolbar { flex-wrap: wrap; } }
```

