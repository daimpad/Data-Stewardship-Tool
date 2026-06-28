// Page: list of projects (filled-in questionnaires).

import * as storage from '../storage.js';
import * as M from '../models.js';
import { esc } from '../util.js';

export function render(container) {
  const projects = storage.getProjects();
  const kmsById = Object.fromEntries(storage.getKMs().map((k) => [k.id, k]));

  container.innerHTML = `
    <div id="proj-root">
      <div class="page-head"><h1>Projekte</h1></div>
      <p class="muted">Ein Projekt ist ein ausgefüllter Fragebogen auf Basis eines
        Wissensmodells. Neue Projekte legst du bei einem Wissensmodell über
        „Projekt anlegen" an.</p>
      ${projects.length === 0 ? '<p class="muted">Noch keine Projekte.</p>' : ''}
      <ul class="cards">
        ${projects.map((p) => {
          const km = kmsById[p.kmId];
          const prog = km ? M.countProgress(km, p.replies) : { answered: 0, total: 0 };
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
                <button type="button" class="btn-sm danger" data-action="del" data-id="${esc(p.id)}">Löschen</button>
              </div>
            </li>`;
        }).join('')}
      </ul>
    </div>
  `;

  container.querySelector('#proj-root').addEventListener('click', (e) => {
    if (e.target.dataset.action === 'del') {
      if (confirm('Projekt wirklich löschen?')) {
        storage.deleteProject(e.target.dataset.id);
        render(container);
      }
    }
  });
}
