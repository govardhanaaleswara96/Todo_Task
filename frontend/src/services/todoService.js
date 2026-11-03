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
