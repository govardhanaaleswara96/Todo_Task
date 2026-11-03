import Todo from '../models/Todo.js';

function notFound(res) {
  // Same response for a missing record and a record owned by someone else.
  return res.status(404).json({ success: false, message: 'Todo not found.' });
}

export async function createTodo(req, res, next) {
  try {
    const todo = await Todo.create({ ...req.todoInput, userId: req.user._id });
    res.location(`/api/todos/${todo.id}`).status(201).json({ success: true, todo });
  } catch (error) { next(error); }
}

export async function getTodos(req, res, next) {
  try {
    const todos = await Todo.find({ userId: req.user._id }).sort({ createdAt: -1, _id: -1 });
    res.json({ success: true, todos });
  } catch (error) { next(error); }
}

export async function getTodo(req, res, next) {
  try {
    const todo = await Todo.findOne({ _id: req.params.id, userId: req.user._id });
    if (!todo) return notFound(res);
    res.json({ success: true, todo });
  } catch (error) { next(error); }
}

export async function updateTodo(req, res, next) {
  try {
    const todo = await Todo.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { $set: req.todoInput },
      { new: true, runValidators: true },
    );
    if (!todo) return notFound(res);
    res.json({ success: true, todo });
  } catch (error) { next(error); }
}

export async function deleteTodo(req, res, next) {
  try {
    const todo = await Todo.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    if (!todo) return notFound(res);
    res.status(204).end();
  } catch (error) { next(error); }
}
