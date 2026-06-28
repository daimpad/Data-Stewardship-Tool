// Tiny shared helpers.

// Escape a value for safe insertion into HTML (text or attribute context).
export function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

// "Not found" placeholder markup used by a few pages.
export function notFound(what) {
  return `<p>${esc(what)} nicht gefunden. <a href="#/km">Zur Startseite</a></p>`;
}

// Filename-safe slug from a title.
export function slug(s, fallback = 'export') {
  return (s || fallback).toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || fallback;
}

// Trigger a browser download of an object as pretty-printed JSON.
export function downloadJson(filename, obj) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
