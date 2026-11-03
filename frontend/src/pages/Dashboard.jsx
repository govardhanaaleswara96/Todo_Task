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
