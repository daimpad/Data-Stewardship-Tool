// Bootstrap + hash router. Each route maps a URL hash to a page module's
// render(container, params) function.

import * as storage from './storage.js';
import * as kmList from './pages/kmList.js';
import * as kmEditor from './pages/kmEditor.js';
import * as projectList from './pages/projectList.js';
import * as questionnaire from './pages/questionnaire.js';
import * as documentPage from './pages/document.js';

const routes = [
  { re: /^#\/km$/, page: kmList, params: () => ({}) },
  { re: /^#\/km\/([^/]+)\/edit$/, page: kmEditor, params: (m) => ({ id: m[1] }) },
  { re: /^#\/projects$/, page: projectList, params: () => ({}) },
  { re: /^#\/projects\/([^/]+)\/document$/, page: documentPage, params: (m) => ({ id: m[1] }) },
  { re: /^#\/projects\/([^/]+)$/, page: questionnaire, params: (m) => ({ id: m[1] }) },
];

const app = document.getElementById('app');

function setActiveNav(hash) {
  document.querySelectorAll('[data-nav]').forEach((a) => {
    const key = a.dataset.nav;
    const active = (key === 'km' && hash.startsWith('#/km'))
      || (key === 'projects' && hash.startsWith('#/projects'));
    a.classList.toggle('active', active);
  });
}

function route() {
  const hash = location.hash || '#/km';
  for (const r of routes) {
    const m = hash.match(r.re);
    if (m) {
      setActiveNav(hash);
      app.scrollTo?.(0, 0);
      r.page.render(app, r.params(m));
      return;
    }
  }
  location.hash = '#/km'; // unknown route → home
}

window.addEventListener('hashchange', route);

(async function start() {
  await storage.seedIfEmpty();
  if (!location.hash) location.hash = '#/km';
  else route();
})();
