import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { createApp } from '../app.js';
import User from '../models/User.js';
import { verifyGoogleToken } from '../services/googleService.js';
import { validateAuthConfig, JWT_ISSUER, JWT_AUDIENCE } from '../config/auth.js';

// Real MongoDB, unique database per run. Google responses are mocked: no real
// Google account, token, or application database is used by this suite.
test('Google authentication and cookie session integration', async () => {
  const dbName = `todo_auth_test_${randomUUID().replaceAll('-', '')}`;
  process.env.JWT_SECRET = randomUUID() + randomUUID();
  process.env.FRONTEND_URL = 'http://localhost:5174';
  process.env.NODE_ENV = 'development';
  validateAuthConfig();
  await mongoose.connect(process.env.TEST_MONGODB_URI || 'mongodb://127.0.0.1:27017', { dbName });
  let server;
  try {
    await User.init();
    const payloads = {
      new: { sub: 'google-new', email: 'test@gmail.com', email_verified: true, name: 'Test User' },
      repeat: { sub: 'google-new', email: 'changed@gmail.com', email_verified: true, name: 'Test User' },
      unverified: { sub: 'unverified', email: 'no@gmail.com', email_verified: false },
      legacy: { sub: 'google-legacy', email: 'legacy@gmail.com', email_verified: true },
      collision: { sub: 'different-google-id', email: 'test@gmail.com', email_verified: true },
      thirdparty: { sub: 'third-party', email: 'existing@example.com', email_verified: true },
    };
    const app = createApp({ googleVerifier: async (credential) => {
      if (!payloads[credential]) { const error = new Error('Invalid Google token.'); error.status = 401; throw error; }
      return payloads[credential];
    } });
    server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    const base = `http://127.0.0.1:${server.address().port}/api/auth`;
    async function post(path, body, origin = 'http://localhost:5174') {
      return fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin }, body: JSON.stringify(body) });
    }
    assert.equal((await fetch(base + '/profile')).status, 401);
    assert.equal((await post('/google', {})).status, 400);
    assert.equal((await post('/google', { credential: 12 })).status, 400);
    assert.equal((await post('/google', { credential: 'invalid' })).status, 401);
    assert.equal((await post('/google', { credential: 'unverified' })).status, 401);
    assert.equal((await post('/google', { credential: 'new' }, 'https://untrusted.example')).status, 403);
    const formResponse = await fetch(base + '/google', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'credential=new' });
    assert.equal(formResponse.status, 415);
    const malformed = await fetch(base + '/google', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{bad' });
    assert.equal(malformed.status, 400);
    const signedIn = await post('/google', { credential: 'new', email: 'attacker@gmail.com', name: 'Attacker' });
    assert.equal(signedIn.status, 200);
    assert.equal(signedIn.headers.get('access-control-allow-origin'), 'http://localhost:5174');
    assert.equal(signedIn.headers.get('access-control-allow-credentials'), 'true');
    assert.equal(signedIn.headers.get('cache-control'), 'no-store');
    const cookie = signedIn.headers.get('set-cookie');
    assert.match(cookie, /HttpOnly/);
    assert.match(cookie, /SameSite=Lax/);
    assert.match(cookie, /Path=\/api/);
    const body = await signedIn.json();
    assert.equal(body.user.email, 'test@gmail.com');
    assert.equal(body.user.name, 'Test User');
    assert.equal(body.token, undefined);
    assert.equal(body.user.password, undefined);
    assert.equal(body.user.googleId, undefined);
    const profile = await fetch(base + '/profile', { headers: { Cookie: cookie.split(';')[0] } });
    assert.equal(profile.status, 200);
    assert.equal((await profile.json()).user.id, body.user.id);
    await post('/google', { credential: 'repeat' });
    assert.equal(await User.countDocuments(), 1);
    assert.equal((await post('/google', { credential: 'collision' })).status, 409);
    await User.create({ name: 'Legacy', email: 'legacy@gmail.com', password: 'existing-hash-must-not-change' });
    assert.equal((await post('/google', { credential: 'legacy' })).status, 200);
    assert.equal((await User.findOne({ email: 'legacy@gmail.com' }).select('+password')).password, 'existing-hash-must-not-change');
    await User.create({ name: 'Existing', email: 'existing@example.com' });
    assert.equal((await post('/google', { credential: 'thirdparty' })).status, 409);
    const tokenOptions = { subject: body.user.id, issuer: JWT_ISSUER, audience: JWT_AUDIENCE, expiresIn: -1 };
    const expired = jwt.sign({}, process.env.JWT_SECRET, tokenOptions);
    assert.equal((await fetch(base + '/profile', { headers: { Cookie: `todo_session=${expired}` } })).status, 401);
    assert.equal((await fetch(base + '/profile', { headers: { Cookie: 'todo_session=invalid' } })).status, 401);
    const wrongAudience = jwt.sign({}, process.env.JWT_SECRET, { ...tokenOptions, expiresIn: 60, audience: 'wrong-app' });
    assert.equal((await fetch(base + '/profile', { headers: { Cookie: `todo_session=${wrongAudience}` } })).status, 401);
    process.env.NODE_ENV = 'production';
    assert.match((await post('/google', { credential: 'new' })).headers.get('set-cookie'), /Secure/);
    process.env.NODE_ENV = 'development';
    const loggedOut = await post('/logout', {});
    assert.match(loggedOut.headers.get('set-cookie'), /todo_session=;/);
    assert.match(loggedOut.headers.get('set-cookie'), /Expires=Thu, 01 Jan 1970/);
    await User.deleteOne({ _id: body.user.id });
    assert.equal((await fetch(base + '/profile', { headers: { Cookie: cookie.split(';')[0] } })).status, 401);
    const oldClientId = process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_ID;
    await assert.rejects(verifyGoogleToken('anything'), error => error.status === 503);
    if (oldClientId !== undefined) process.env.GOOGLE_CLIENT_ID = oldClientId;
    console.log('Verified: Google account lifecycle, cookie flags, profile protection, errors, origin checks, and legacy account safety.');
  } finally {
    // This database was generated by this test run; never drop the app database.
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
    if (server) await new Promise(resolve => server.close(resolve));
  }
});
