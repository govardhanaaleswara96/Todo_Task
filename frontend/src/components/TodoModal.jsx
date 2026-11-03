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
