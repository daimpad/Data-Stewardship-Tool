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
