// Page: list of knowledge models (create / import / edit / export /
// start project / delete).

import * as storage from '../storage.js';
import * as M from '../models.js';
import { esc } from '../util.js';

function countQuestions(km) {
  let n = 0;
  M.walkQuestionArrays(km, (arr) => { n += arr.length; });
  return n;
}

// Light structural check for an imported KM (not a full schema validation).
function isValidKM(d) {
  return d && typeof d === 'object'
    && typeof d.title === 'string'
    && Array.isArray(d.chapters)
    && d.chapters.every((ch) => ch && typeof ch.title === 'string' && Array.isArray(ch.questions));
}

function slug(s) {
  return (s || 'wissensmodell').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'wissensmodell';
}

function downloadJson(filename, obj) {
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

export function render(container) {
  const kms = storage.getKMs();

  container.innerHTML = `
    <div id="km-root">
      <div class="page-head">
        <h1>Wissensmodelle</h1>
        <span class="head-actions">
          <button type="button" class="btn secondary" data-action="import">Importieren</button>
          <button type="button" class="btn" data-action="new">+ Neues Wissensmodell</button>
        </span>
      </div>
      <input type="file" id="km-import-input" accept="application/json,.json" hidden>
      <p class="muted">Ein Wissensmodell ist die Vorlage: Kapitel, Fragen und Antworten,
        auf deren Basis später Fragebögen ausgefüllt werden. Modelle lassen sich als
        JSON exportieren und wieder importieren (zum Teilen oder Sichern).</p>
      ${kms.length === 0 ? '<p class="muted">Noch keine Wissensmodelle. Lege eines an oder importiere eines.</p>' : ''}
      <ul class="cards">
        ${kms.map((k) => `
          <li class="card">
            <div class="card-body">
              <h3>${esc(k.title)}</h3>
              ${k.description ? `<p class="muted">${esc(k.description)}</p>` : ''}
              <p class="meta">${k.chapters.length} Kapitel · ${countQuestions(k)} Fragen</p>
            </div>
            <div class="card-actions">
              <a class="btn-sm secondary" href="#/km/${esc(k.id)}/edit">Bearbeiten</a>
              <button type="button" class="btn-sm" data-action="use" data-id="${esc(k.id)}">Projekt anlegen</button>
              <button type="button" class="btn-sm secondary" data-action="export" data-id="${esc(k.id)}">Export</button>
              <button type="button" class="btn-sm danger" data-action="del" data-id="${esc(k.id)}">Löschen</button>
            </div>
          </li>`).join('')}
      </ul>
    </div>
  `;

  const root = container.querySelector('#km-root');
  const importInput = container.querySelector('#km-import-input');

  root.addEventListener('click', (e) => {
    const action = e.target.dataset.action;
    if (!action) return;
    const id = e.target.dataset.id;

    if (action === 'new') {
      const km = storage.saveKM(M.newKM());
      location.hash = `#/km/${km.id}/edit`;
    } else if (action === 'import') {
      importInput.click();
    } else if (action === 'export') {
      const km = storage.getKM(id);
      if (km) downloadJson(`${slug(km.title)}.json`, km);
    } else if (action === 'use') {
      const km = storage.getKM(id);
      const project = storage.saveProject(M.newProject(id, `Projekt – ${km.title}`));
      location.hash = `#/projects/${project.id}`;
    } else if (action === 'del') {
      if (confirm('Wissensmodell wirklich löschen?')) {
        storage.deleteKM(id);
        render(container);
      }
    }
  });

  importInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (!isValidKM(data)) throw new Error('Kein gültiges Wissensmodell (title/chapters fehlen).');
      data.id = M.uid('km'); // fresh id so an import never overwrites an existing model
      data.createdAt = new Date().toISOString();
      storage.saveKM(data);
      render(container);
    } catch (err) {
      alert(`Import fehlgeschlagen: ${err.message}`);
    } finally {
      e.target.value = ''; // allow re-importing the same file
    }
  });
}
