import api from './api.js';

export async function getDocumentationCatalog(signal) {
  return (await api.get('/docs', { signal })).data.modules;
}

export async function getModuleSource(id, signal) {
  return (await api.get(`/docs/modules/${encodeURIComponent(id)}`, { signal })).data.module;
}

export async function getAllSource() {
  return (await api.get('/docs/export')).data.files;
}

export function bundleFiles(files, title) {
  const unique = [...new Map(files.map((file) => [file.path, file])).values()];
  return `${title}\n${'='.repeat(60)}\n\n` + unique.map((file) =>
    `FILE: ${file.path}\n${'-'.repeat(60)}\n${file.status === 'available' ? file.code : `[${file.status.toUpperCase()}] ${file.message}`}\n`
  ).join('\n');
}

export async function copyText(text) {
  try {
    if (!navigator.clipboard?.writeText) throw new Error('Clipboard API unavailable');
    await navigator.clipboard.writeText(text);
    return;
  } catch {
    // Fallback for browsers without the secure-context Clipboard API.
    const previousFocus = document.activeElement;
    const field = document.createElement('textarea');
    field.value = text;
    field.setAttribute('readonly', '');
    field.style.position = 'fixed';
    field.style.top = '-9999px';
    document.body.appendChild(field);
    field.select();
    let copied;
    try { copied = document.execCommand('copy'); }
    finally { field.remove(); previousFocus?.focus(); }
    if (!copied) throw new Error('Clipboard access was denied. Select the code and copy it manually.');
  }
}

export function downloadBundle(text, filename) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
