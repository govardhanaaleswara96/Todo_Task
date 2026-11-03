# Backend Todo CRUD — complete source changes

The following files are complete, not patches. This extends the existing server and reuses the unchanged Google JWT cookie middleware. No dependencies or environment variables were added. See [README.md](README.md#backend-todo-crud) for endpoints, requests, validation, response codes, and running instructions. The React dashboard uses these APIs; see [TODO_FRONTEND_CODE.md](TODO_FRONTEND_CODE.md) for the integration.

## backend/models/Todo.js

```javascript
import mongoose from 'mongoose';

const todoSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
  title: { type: String, required: true, trim: true, maxlength: 120 },
  description: { type: String, trim: true, default: '', maxlength: 1000 },
  status: { type: String, enum: ['Pending', 'Completed'], default: 'Pending', required: true },
}, { timestamps: true, versionKey: false });

// Supports the user-scoped list, sorted newest first.
todoSchema.index({ userId: 1, createdAt: -1 });

export default mongoose.model('Todo', todoSchema);
```

## backend/middleware/todoValidation.js

```javascript
import mongoose from 'mongoose';

export function validateTodoId(req, res, next) {
  if (!mongoose.isObjectIdOrHexString(req.params.id)) {
    return res.status(400).json({ success: false, message: 'Invalid Todo ID. Use a 24-character MongoDB ObjectId.' });
  }
  next();
}

export function validateTodoInput(req, res, next) {
  const body = req.body;
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return res.status(400).json({ success: false, message: 'Send a JSON object containing Todo fields.' });
  }
  const fields = Object.keys(body);
  const allowed = ['title', 'description', 'status'];
  if (fields.some((field) => !allowed.includes(field))) {
    return res.status(400).json({ success: false, message: 'Only title, description, and status can be supplied.' });
  }
  if (req.method === 'PUT' && !fields.length) {
    return res.status(400).json({ success: false, message: 'Provide at least one field to update.' });
  }

  const errors = {};
  const input = {};
  const has = (field) => Object.hasOwn(body, field);
  if (req.method === 'POST' || has('title')) {
    if (typeof body.title !== 'string' || !body.title.trim()) errors.title = 'Title is required and must be a nonblank string.';
    else if (body.title.trim().length > 120) errors.title = 'Title must be 120 characters or fewer.';
    else input.title = body.title.trim();
  }
  if (has('description')) {
    if (typeof body.description !== 'string') errors.description = 'Description must be a string.';
    else if (body.description.trim().length > 1000) errors.description = 'Description must be 1000 characters or fewer.';
    else input.description = body.description.trim();
  }
  if (has('status')) {
    if (!['Pending', 'Completed'].includes(body.status)) errors.status = 'Status must be Pending or Completed.';
    else input.status = body.status;
  }
  if (Object.keys(errors).length) {
    return res.status(400).json({ success: false, message: 'Invalid Todo fields.', errors });
  }
  // Pass only validated values to Mongoose. Ownership always comes from the JWT.
  req.todoInput = input;
  next();
}
```

## backend/controllers/todoController.js

```javascript
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
```

## backend/routes/todoRoutes.js

```javascript
import { Router } from 'express';
import { requireAuth } from '../middleware/authMiddleware.js';
import { validateTodoId, validateTodoInput } from '../middleware/todoValidation.js';
import { createTodo, getTodos, getTodo, updateTodo, deleteTodo } from '../controllers/todoController.js';

const router = Router();
router.use((req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
router.use(requireAuth);
router.route('/').get(getTodos).post(validateTodoInput, createTodo);
router.route('/:id')
  .all(validateTodoId)
  .get(getTodo)
  .put(validateTodoInput, updateTodo)
  .delete(deleteTodo);

// Todo-specific failures stay separate from the existing auth error responses.
router.use((error, req, res, next) => {
  if (error.name === 'ValidationError' || error.name === 'CastError') {
    return res.status(400).json({ success: false, message: 'Invalid Todo data.' });
  }
  console.error('Todo request failed:', error.name);
  res.status(500).json({ success: false, message: 'Could not complete the Todo request. Please try again.' });
});

export default router;
```

## backend/app.js

```javascript
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import healthRoutes from './routes/healthRoutes.js';
import { createAuthRoutes } from './routes/authRoutes.js';
import todoRoutes from './routes/todoRoutes.js';

export function createApp({ googleVerifier } = {}) {
  const app = express();
  const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:5174')
    .split(',').map((origin) => origin.trim()).filter(Boolean);

  app.disable('x-powered-by');
  app.use(cors({
    origin(origin, callback) { callback(null, !origin || allowedOrigins.includes(origin)); },
    credentials: true,
  }));
  // Cookie authentication requires CSRF protection. Browser mutations must come
  // from our allowlisted origin and use JSON (which requires a CORS preflight).
  app.use((req, res, next) => {
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      if (req.get('origin') && !allowedOrigins.includes(req.get('origin'))) {
        return res.status(403).json({ success: false, message: 'Request origin is not allowed.' });
      }
      // DELETE is already a non-simple, preflighted browser method and needs
      // no JSON body. Keep the existing JSON rule for all auth requests.
      const isTodoDelete = req.method === 'DELETE' && req.path.startsWith('/api/todos/');
      if (!req.is('application/json') && !isTodoDelete) {
        return res.status(415).json({ success: false, message: 'Use Content-Type: application/json.' });
      }
    }
    next();
  });
  app.use(express.json({ limit: '20kb' }));
  app.use(cookieParser());
  app.use('/api', healthRoutes);
  app.use('/api/auth', createAuthRoutes(googleVerifier));
  app.use('/api/todos', todoRoutes);
  app.use((req, res) => {
    res.status(404).json({ success: false, message: 'API endpoint not found.' });
  });
  app.use((error, req, res, next) => {
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: 'This account already exists. Please try signing in again.' });
    }
    if (error.name === 'ValidationError') {
      return res.status(400).json({ success: false, message: 'Account information is invalid.' });
    }
    if (error.type === 'entity.parse.failed') {
      return res.status(400).json({ success: false, message: 'Invalid JSON request.' });
    }
    if (error.type === 'entity.too.large') {
      return res.status(413).json({ success: false, message: 'Request is too large.' });
    }
    const status = error.status || 500;
    // Do not log tokens, credentials, or database connection strings.
    if (status >= 500) console.error('Request failed:', error.name);
    res.status(status).json({ success: false, message: status < 500 || status === 503
      ? (status === 503 ? 'Google sign-in is not configured or temporarily unavailable.' : error.message)
      : 'An unexpected server error occurred.' });
  });
  return app;
}

export default createApp();
```

## backend/tests/todos.test.js

```javascript
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { createApp } from '../app.js';
import User from '../models/User.js';
import Todo from '../models/Todo.js';
import { COOKIE_NAME, JWT_ISSUER, JWT_AUDIENCE } from '../config/auth.js';

test('Todo CRUD validates data and isolates authenticated users', async () => {
  const dbName = `todo_crud_test_${randomUUID().replaceAll('-', '')}`;
  process.env.JWT_SECRET = randomUUID() + randomUUID();
  process.env.FRONTEND_URL = 'http://localhost:5174';
  await mongoose.connect(process.env.TEST_MONGODB_URI || 'mongodb://127.0.0.1:27017', { dbName });
  let server;
  try {
    await Promise.all([User.init(), Todo.init()]);
    const [alice, bob] = await User.create([
      { name: 'Alice', email: 'alice@example.com', googleId: 'test-alice' },
      { name: 'Bob', email: 'bob@example.com', googleId: 'test-bob' },
    ]);
    const cookieFor = (user, expiresIn = 3600) => `${COOKIE_NAME}=${jwt.sign({}, process.env.JWT_SECRET, {
      subject: user.id, issuer: JWT_ISSUER, audience: JWT_AUDIENCE, expiresIn,
    })}`;
    const aliceCookie = cookieFor(alice), bobCookie = cookieFor(bob);
    server = createApp().listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    const base = `http://127.0.0.1:${server.address().port}/api/todos`;
    async function request(method, path = '', cookie = aliceCookie, body) {
      return fetch(base + path, {
        method,
        headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:5174', ...(cookie ? { Cookie: cookie } : {}) },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
    }
    const missingId = new mongoose.Types.ObjectId().toString();
    for (const [method, path] of [['POST', ''], ['GET', ''], ['GET', `/${missingId}`], ['PUT', `/${missingId}`], ['DELETE', `/${missingId}`]]) {
      assert.equal((await request(method, path, '', ['POST', 'PUT'].includes(method) ? { title: 'No session' } : undefined)).status, 401);
    }
    assert.equal((await request('GET', '', cookieFor(alice, -1))).status, 401);
    assert.equal((await request('GET', '', `${COOKIE_NAME}=tampered`)).status, 401);
    assert.deepEqual((await (await request('GET')).json()).todos, []);
    const created = await request('POST', '', aliceCookie, { title: '  First task  ', description: '  Notes  ' });
    assert.equal(created.status, 201);
    assert.equal(created.headers.get('cache-control'), 'no-store');
    const { todo } = await created.json();
    assert.equal(created.headers.get('location'), `/api/todos/${todo._id}`);
    assert.equal(todo.title, 'First task');
    assert.equal(todo.description, 'Notes');
    assert.equal(todo.status, 'Pending');
    assert.equal(todo.userId, alice.id);
    assert.ok(Date.parse(todo.createdAt));
    assert.ok(Date.parse(todo.updatedAt));
    assert.equal(todo.__v, undefined);
    const path = `/${todo._id}`;
    const bobResponse = await request('POST', '', bobCookie, { title: 'Bob task', status: 'Completed' });
    assert.equal(bobResponse.status, 201);
    assert.equal((await bobResponse.json()).todo.description, '');
    const ownList = (await (await request('GET')).json()).todos;
    assert.equal(ownList.length, 1);
    assert.equal(ownList[0]._id, todo._id);
    assert.equal((await request('GET', path)).status, 200);
    const bobList = (await (await request('GET', '', bobCookie)).json()).todos;
    assert.equal(bobList.length, 1);
    assert.equal(bobList[0].userId, bob.id);
    for (const method of ['GET', 'PUT', 'DELETE']) {
      const foreign = await request(method, path, bobCookie, method === 'PUT' ? { title: 'Stolen' } : undefined);
      assert.equal(foreign.status, 404);
      assert.equal((await foreign.json()).message, 'Todo not found.');
      assert.equal((await request(method, `/${missingId}`, aliceCookie, method === 'PUT' ? { status: 'Completed' } : undefined)).status, 404);
    }
    assert.equal((await Todo.findById(todo._id)).title, 'First task');
    for (const method of ['GET', 'PUT', 'DELETE']) {
      for (const id of ['invalid-id', '123456789012', 'z'.repeat(24)]) {
        assert.equal((await request(method, `/${id}`, aliceCookie, method === 'PUT' ? { title: 'Task' } : undefined)).status, 400);
      }
    }
    const invalidInputs = [
      { title: '' }, { title: '   ' }, { title: null }, { title: 1 }, { title: [] }, { title: { $ne: '' } },
      { title: 'x'.repeat(121) }, { title: 'Task', description: null }, { title: 'Task', description: [] },
      { title: 'Task', description: 'x'.repeat(1001) }, { title: 'Task', status: 'completed' },
      { title: 'Task', status: null }, { title: 'Task', status: { $ne: 'Pending' } },
      { title: 'Task', userId: bob.id }, { title: 'Task', createdAt: '2020-01-01' },
      { title: 'Task', updatedAt: '2020-01-01' }, { title: 'Task', _id: missingId },
      { $set: { userId: bob.id } }, [],
    ];
    for (const body of invalidInputs) {
      assert.equal((await request('POST', '', aliceCookie, body)).status, 400, JSON.stringify(body));
      assert.equal((await request('PUT', path, aliceCookie, body)).status, 400, JSON.stringify(body));
    }
    assert.equal((await request('POST', '', aliceCookie, {})).status, 400);
    assert.equal((await request('PUT', path, aliceCookie, {})).status, 400);
    assert.equal((await request('PUT', path, aliceCookie, { userId: bob.id })).status, 400);
    await new Promise(resolve => setTimeout(resolve, 10));
    const update = await request('PUT', path, aliceCookie, { title: 'x'.repeat(120), description: 'x'.repeat(1000), status: 'Completed' });
    assert.equal(update.status, 200);
    const updated = (await update.json()).todo;
    assert.equal(updated.status, 'Completed');
    assert.equal(updated.createdAt, todo.createdAt);
    assert.ok(Date.parse(updated.updatedAt) > Date.parse(todo.updatedAt));
    assert.equal(updated.userId, alice.id);
    const partial = await request('PUT', path, aliceCookie, { description: '' });
    assert.equal(partial.status, 200);
    const partialTodo = (await partial.json()).todo;
    assert.equal(partialTodo.description, '');
    assert.equal(partialTodo.title, updated.title);
    assert.equal(partialTodo.status, 'Completed');
    const invalidJson = await fetch(base, { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: aliceCookie }, body: '{broken' });
    assert.equal(invalidJson.status, 400);
    const untrusted = await fetch(base, { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: aliceCookie, Origin: 'https://untrusted.example' }, body: '{"title":"Task"}' });
    assert.equal(untrusted.status, 403);
    const unsupported = await fetch(base, { method: 'POST', headers: { 'Content-Type': 'text/plain', Cookie: aliceCookie }, body: 'Task' });
    assert.equal(unsupported.status, 415);
    const oversized = await request('POST', '', aliceCookie, { title: 'Task', description: 'x'.repeat(25000) });
    assert.equal(oversized.status, 413);
    const deleted = await request('DELETE', path);
    assert.equal(deleted.status, 204);
    assert.equal(await deleted.text(), '');
    assert.equal((await request('GET', path)).status, 404);
    assert.equal((await request('DELETE', path)).status, 404);
    assert.deepEqual((await (await request('GET')).json()).todos, []);
    assert.equal((await (await request('GET', '', bobCookie)).json()).todos.length, 1);
    console.log('Verified: all five APIs, JWT protection, two-user ownership, defaults, validation, timestamps, partial updates, deletion and HTTP errors.');
  } finally {
    // Delete only the unique database created by this test run.
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
    if (server) await new Promise(resolve => server.close(resolve));
  }
});
```

