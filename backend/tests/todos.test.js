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
