// Page: list of projects (filled-in questionnaires) — with duplicate,
// JSON export/import, and delete.

import * as storage from '../storage.js';
import * as M from '../models.js';
import { esc, slug, downloadJson } from '../util.js';

// Light structural check for an imported project.
function isValidProject(d) {
  return d && typeof d === 'object'
    && typeof d.name === 'string'
    && typeof d.kmId === 'string'
    && d.replies && typeof d.replies === 'object' && !Array.isArray(d.replies);
}

export function render(container) {
  const projects = storage.getProjects();
  const kmsById = Object.fromEntries(storage.getKMs().map((k) => [k.id, k]));

  container.innerHTML = `
    <div id="proj-root">
      <div class="page-head">
        <h1>Projekte</h1>
        <span class="head-actions">
          <button type="button" class="btn secondary" data-action="import">Importieren</button>
        </span>
      </div>
      <input type="file" id="proj-import-input" accept="application/json,.json" hidden>
      <p class="muted">Ein Projekt ist ein ausgefüllter Fragebogen auf Basis eines
        Wissensmodells. Neue Projekte legst du bei einem Wissensmodell über
        „Projekt anlegen" an; bestehende lassen sich duplizieren, exportieren und importieren.</p>
      ${projects.length === 0 ? '<p class="muted">Noch keine Projekte.</p>' : ''}
      <ul class="cards">
        ${projects.map((p) => {
          const km = kmsById[p.kmId];
          const prog = km ? M.countProgress(km, p.replies, p.selectedTagIds) : { answered: 0, total: 0 };
          return `
            <li class="card">
              <div class="card-body">
                <h3>${esc(p.name)}</h3>
                <p class="meta">
                  ${km ? esc(km.title) : '<em>Wissensmodell fehlt</em>'}
                  · ${prog.answered}/${prog.total} beantwortet
                </p>
              </div>
              <div class="card-actions">
                <a class="btn-sm" href="#/projects/${esc(p.id)}">Ausfüllen</a>
                <a class="btn-sm secondary" href="#/projects/${esc(p.id)}/document">Dokument</a>
                <button type="button" class="btn-sm secondary" data-action="duplicate" data-id="${esc(p.id)}">Duplizieren</button>
                <button type="button" class="btn-sm secondary" data-action="export" data-id="${esc(p.id)}">Export</button>
                <button type="button" class="btn-sm danger" data-action="del" data-id="${esc(p.id)}">Löschen</button>
              </div>
            </li>`;
        }).join('')}
      </ul>
    </div>
  `;

  const root = container.querySelector('#proj-root');
  const importInput = container.querySelector('#proj-import-input');

  root.addEventListener('click', (e) => {
    const action = e.target.dataset.action;
    if (!action) return;
    const id = e.target.dataset.id;

    if (action === 'import') {
      importInput.click();
    } else if (action === 'export') {
      const p = storage.getProject(id);
      if (p) downloadJson(`${slug(p.name, 'projekt')}.json`, p);
    } else if (action === 'duplicate') {
      const p = storage.getProject(id);
      if (p) { storage.saveProject(M.duplicateProject(p)); render(container); }
    } else if (action === 'del') {
      if (confirm('Projekt wirklich löschen?')) {
        storage.deleteProject(id);
        render(container);
      }
    }
  });

  importInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (!isValidProject(data)) throw new Error('Kein gültiges Projekt (name/kmId/replies fehlen).');
      data.id = M.uid('prj'); // fresh id so an import never overwrites an existing project
      data.createdAt = new Date().toISOString();
      storage.saveProject(data);
      if (!storage.getKM(data.kmId)) {
        alert('Projekt importiert. Hinweis: Das zugehörige Wissensmodell ist hier nicht vorhanden — '
          + 'importiere es separat, damit Fragebogen und Dokument vollständig funktionieren.');
      }
      render(container);
    } catch (err) {
      alert(`Import fehlgeschlagen: ${err.message}`);
    } finally {
      e.target.value = '';
    }
  });
}
