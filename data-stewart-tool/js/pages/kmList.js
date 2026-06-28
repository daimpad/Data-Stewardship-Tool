// Page: list of knowledge models (create / edit / start project / delete).

import * as storage from '../storage.js';
import * as M from '../models.js';
import { esc } from '../util.js';

function countQuestions(km) {
  let n = 0;
  M.walkQuestionArrays(km, (arr) => { n += arr.length; });
  return n;
}

export function render(container) {
  const kms = storage.getKMs();

  container.innerHTML = `
    <div id="km-root">
      <div class="page-head">
        <h1>Wissensmodelle</h1>
        <button type="button" class="btn" data-action="new">+ Neues Wissensmodell</button>
      </div>
      <p class="muted">Ein Wissensmodell ist die Vorlage: Kapitel, Fragen und Antworten,
        auf deren Basis später Fragebögen ausgefüllt werden.</p>
      ${kms.length === 0 ? '<p class="muted">Noch keine Wissensmodelle. Lege eines an, um zu starten.</p>' : ''}
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
              <button type="button" class="btn-sm danger" data-action="del" data-id="${esc(k.id)}">Löschen</button>
            </div>
          </li>`).join('')}
      </ul>
    </div>
  `;

  container.querySelector('#km-root').addEventListener('click', (e) => {
    const action = e.target.dataset.action;
    if (!action) return;
    const id = e.target.dataset.id;

    if (action === 'new') {
      const km = storage.saveKM(M.newKM());
      location.hash = `#/km/${km.id}/edit`;
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
}
