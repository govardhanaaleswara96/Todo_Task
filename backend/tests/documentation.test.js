import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, mkdir, writeFile, symlink, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from '../app.js';
import { documentationModules, allowedSourcePaths } from '../config/documentation.js';
import { readSourceFile, sanitizeSource } from '../services/documentationService.js';

const projectRoot = fileURLToPath(new URL('../../', import.meta.url));

test('Documentation serves exact allowlisted source without requiring access', async () => {
  const server = createApp().listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api/docs`;
  try {
    const catalogResponse = await fetch(base);
    assert.equal(catalogResponse.status, 200);
    assert.equal(catalogResponse.headers.get('cache-control'), 'no-store');
    const { modules } = await catalogResponse.json();
    assert.equal(modules.length, 13);
    assert.equal(new Set(modules.map(module => module.id)).size, 13);
    for (const module of documentationModules) {
      const response = await fetch(`${base}/modules/${module.id}`);
      assert.equal(response.status, 200);
      const data = (await response.json()).module;
      assert.equal(data.id, module.id);
      for (const file of [...data.frontend, ...data.backend]) {
        assert.equal(file.status, 'available', file.path);
        assert.equal(file.code, sanitizeSource(await readFile(path.join(projectRoot, file.path), 'utf8')).code, file.path);
        assert.ok(allowedSourcePaths.has(file.path));
      }
    }
    const response = await fetch(`${base}/export`);
    const { files } = await response.json();
    assert.equal(files.length, allowedSourcePaths.size);
    assert.equal(new Set(files.map(file => file.path)).size, files.length);
    assert.ok(files.every(file => file.status === 'available'));
    assert.ok(!files.some(file => /(?:^|\/)\.env(?:$|\.(?!example$))/.test(file.path)));
    assert.equal((await fetch(`${base}/modules/not-a-module`)).status, 404);
    assert.equal((await fetch(`${base}/modules/${encodeURIComponent('../../backend/.env')}`)).status, 404);
    assert.equal((await fetch(`${base}/files?path=backend/.env`)).status, 404);
    // Unknown path queries never select a file; export still uses the fixed catalog.
    const injected = await (await fetch(`${base}/export?path=backend/.env`)).json();
    assert.ok(injected.files.every(file => allowedSourcePaths.has(file.path)));
    // Verify every application source/config file is represented somewhere.
    async function scan(directory) {
      const entries = await readdir(path.join(projectRoot, directory), { withFileTypes: true });
      for (const entry of entries) {
        if (['node_modules', 'dist', '.git'].includes(entry.name) || entry.name === '.env' || entry.name === '.gitkeep') continue;
        const relative = `${directory}/${entry.name}`;
        if (entry.isDirectory()) await scan(relative);
        else if (/\.(?:js|jsx|css|json|html)$/.test(entry.name) || entry.name === '.env.example') assert.ok(allowedSourcePaths.has(relative), `Missing from catalog: ${relative}`);
      }
    }
    await scan('frontend'); await scan('backend');
    console.log('Verified: 13 modules, exact source, complete file coverage, deduplicated exports, public access, no arbitrary paths, no real environment files.');
  } finally { await new Promise(resolve => server.close(resolve)); }
});

test('Documentation blocks sensitive paths and symlinks, marks missing files, and redacts known secrets', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'todo-source-docs-'));
  const originalSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'documentation-test-secret-never-export-this-value';
  try {
    await mkdir(path.join(root, 'frontend/src/pages'), { recursive: true });
    await writeFile(path.join(root, 'frontend/src/pages/Login.jsx'), `const accidentallyCopied = '${process.env.JWT_SECRET}';\n`);
    const read = await readSourceFile('frontend/src/pages/Login.jsx', root);
    assert.equal(read.status, 'available');
    assert.equal(read.redacted, true);
    assert.ok(!read.code.includes(process.env.JWT_SECRET));
    assert.ok(read.code.includes('[REDACTED]'));
    assert.equal((await readSourceFile('frontend/src/pages/Signup.jsx', root)).status, 'missing');
    assert.equal((await readSourceFile('backend/.env', root)).status, 'blocked');
    assert.equal((await readSourceFile('frontend/.env', root)).status, 'blocked');
    assert.equal((await readSourceFile('../private-key.pem', root)).status, 'blocked');
    await writeFile(path.join(root, 'private.env'), 'JWT_SECRET=do-not-read');
    await symlink(path.join(root, 'private.env'), path.join(root, 'frontend/src/pages/Signup.jsx'));
    assert.equal((await readSourceFile('frontend/src/pages/Signup.jsx', root)).status, 'blocked');
    const sanitized = sanitizeSource('mongodb+srv://username:password@cluster.example/app\n-----BEGIN PRIVATE KEY-----\nsecret\n-----END PRIVATE KEY-----');
    assert.equal(sanitized.redacted, true);
    assert.ok(!sanitized.code.includes('username:password'));
    assert.ok(!sanitized.code.includes('\nsecret\n'));
  } finally {
    if (originalSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = originalSecret;
    // Only this generated test fixture directory is removed.
    await rm(root, { recursive: true, force: true });
  }
});
