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

// Allow only safe link schemes; returns the url or '' if not allowed.
export function safeHref(url) {
  return /^(https?:\/\/|mailto:)/i.test(url || '') ? url : '';
}

// Minimal, XSS-safe Markdown for guidance text. Escapes first, then applies a
// small inline subset: `code`, [label](url), **bold**, _italic_, line breaks.
// Links are restricted to safe schemes.
export function md(text) {
  let s = esc(text);
  s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, label, url) =>
    (/^(https?:\/\/|mailto:)/i.test(url)
      ? `<a href="${url}" target="_blank" rel="noopener noreferrer">${label}</a>`
      : m));
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/_([^_]+)_/g, '<em>$1</em>');
  s = s.replace(/\n/g, '<br>');
  return s;
}

// Render a question's references as a list of links (safe). Empty -> ''.
export function referencesHtml(references) {
  if (!references || !references.length) return '';
  const items = references.map((r) => {
    const href = safeHref(r.url);
    const text = esc(r.label || r.url || 'Link');
    return href
      ? `<li><a href="${esc(href)}" target="_blank" rel="noopener noreferrer">${text}</a></li>`
      : `<li>${text}</li>`;
  }).join('');
  return `<ul class="references">${items}</ul>`;
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
