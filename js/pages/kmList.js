// Page: list of knowledge models (create / import / edit / export /
// start project / delete).

import * as storage from '../storage.js';
import * as M from '../models.js';
import { TEMPLATES } from '../templates.js';
import { esc, slug, downloadJson } from '../util.js';

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

      <h2 class="tmpl-head">Vorlagen</h2>
      <p class="muted">Fertige, an etablierten DMP-Vorgaben orientierte Wissensmodelle.
        „Übernehmen" legt eine bearbeitbare Kopie in deinen Modellen an.</p>
      <ul class="cards">
        ${TEMPLATES.map((t) => `
          <li class="card">
            <div class="card-body">
              <h3>${esc(t.title)}</h3>
              <p class="muted">${esc(t.description)}</p>
            </div>
            <div class="card-actions">
              <button type="button" class="btn-sm" data-action="add-template" data-id="${esc(t.id)}">Übernehmen</button>
            </div>
          </li>`).join('')}
      </ul>
    </div>
  `;

  const root = container.querySelector('#km-root');
  const importInput = container.querySelector('#km-import-input');

  root.addEventListener('click', async (e) => {
    const action = e.target.dataset.action;
    if (!action) return;
    const id = e.target.dataset.id;

    if (action === 'new') {
      const km = storage.saveKM(M.newKM());
      location.hash = `#/km/${km.id}/edit`;
    } else if (action === 'add-template') {
      const t = TEMPLATES.find((x) => x.id === id);
      if (!t) return;
      try {
        const res = await fetch(t.file);
        if (!res.ok) throw new Error('Datei nicht gefunden');
        const km = await res.json();
        km.id = M.uid('km'); // fresh id so it lands as a new, editable copy
        km.createdAt = new Date().toISOString();
        storage.saveKM(km);
        location.hash = `#/km/${km.id}/edit`;
      } catch (err) {
        alert(`Vorlage konnte nicht geladen werden: ${err.message}`);
      }
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
