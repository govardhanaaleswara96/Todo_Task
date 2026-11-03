import { readFile, realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { allowedSourcePaths, documentationModules } from '../config/documentation.js';

const projectRoot = fileURLToPath(new URL('../../', import.meta.url));

export function fileInfo(filePath) {
  const extension = path.extname(filePath);
  const language = filePath.endsWith('.env.example') ? 'ini' : ({
    '.js': 'javascript', '.jsx': 'javascript', '.json': 'json', '.css': 'css', '.html': 'xml', '.md': 'markdown',
  }[extension] || 'plaintext');
  return { path: filePath, name: path.basename(filePath), language };
}

export function getDocumentationCatalog() {
  return documentationModules.map((module) => ({
    ...module, frontend: module.frontend.map(fileInfo), backend: module.backend.map(fileInfo),
  }));
}

export function sanitizeSource(source) {
  let code = source;
  // Do not serialize process.env. Redact any configured secret that was copied
  // into an allowlisted source file accidentally. Public client IDs are not secrets.
  for (const [key, value] of Object.entries(process.env)) {
    if (value && value.length >= 4 && /(?:SECRET|PASSWORD|PRIVATE_KEY|ACCESS_TOKEN|REFRESH_TOKEN|API_KEY|MONGODB_URI)$/i.test(key)) {
      code = code.split(value).join('[REDACTED]');
    }
  }
  code = code.replace(/-----BEGIN (?:[A-Z ]*PRIVATE KEY)-----[\s\S]*?-----END (?:[A-Z ]*PRIVATE KEY)-----/g, '[REDACTED PRIVATE KEY]');
  code = code.replace(/(mongodb(?:\+srv)?:\/\/)[^\s/:@]+:[^\s@]+@/g, '$1[REDACTED]@');
  return { code, redacted: code !== source };
}

export async function readSourceFile(filePath, root = projectRoot) {
  const info = fileInfo(filePath);
  if (!allowedSourcePaths.has(filePath) || (path.basename(filePath).startsWith('.env') && !filePath.endsWith('/.env.example'))) {
    return { ...info, status: 'blocked', message: 'This file is not available for documentation.' };
  }
  try {
    const base = await realpath(root);
    const candidate = path.resolve(base, filePath);
    const actual = await realpath(candidate);
    // Reject symlinks, path traversal, directories, and unexpected large files.
    if (!candidate.startsWith(base + path.sep) || actual !== candidate) {
      return { ...info, status: 'blocked', message: 'Source file is outside the allowed location.' };
    }
    const details = await stat(actual);
    if (!details.isFile() || details.size > 1024 * 1024) {
      return { ...info, status: 'unavailable', message: 'Source file cannot be displayed.' };
    }
    const source = await readFile(actual, 'utf8');
    return { ...info, status: 'available', ...sanitizeSource(source), updatedAt: details.mtime.toISOString() };
  } catch (error) {
    return { ...info, status: error.code === 'ENOENT' ? 'missing' : 'unavailable',
      message: error.code === 'ENOENT' ? 'File is missing from this project. No replacement code was generated.' : 'Source file could not be read.' };
  }
}

export async function getModuleSource(id) {
  const module = documentationModules.find((item) => item.id === id);
  if (!module) return null;
  const [frontend, backend] = await Promise.all([
    Promise.all(module.frontend.map((file) => readSourceFile(file))),
    Promise.all(module.backend.map((file) => readSourceFile(file))),
  ]);
  return { ...module, frontend, backend };
}

export async function getAllSource() {
  return Promise.all([...allowedSourcePaths].map((file) => readSourceFile(file)));
}
