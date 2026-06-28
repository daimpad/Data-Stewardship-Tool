// Page: fill out a questionnaire for a project. Renders the KM tree as a form,
// stores a reply per question (keyed by a dotted path of ids), and reveals
// follow-ups / list items based on current answers.

import * as storage from '../storage.js';
import * as M from '../models.js';
import { esc, notFound } from '../util.js';

const INPUT_TYPE = { string: 'text', number: 'number', date: 'date', email: 'email', url: 'url' };

export function render(container, params) {
  const project = storage.getProject(params.id);
  if (!project) { container.innerHTML = notFound('Projekt'); return; }
  const km = storage.getKM(project.kmId);
  if (!km) { container.innerHTML = '<p>Das zugehörige Wissensmodell wurde nicht gefunden.</p>'; return; }

  container.innerHTML = `
    <div class="page-head no-print">
      <a class="back" href="#/projects">← Projekte</a>
      <a class="btn" href="#/projects/${esc(project.id)}/document">Dokument ansehen →</a>
    </div>
    <h1>${esc(project.name)}</h1>
    <p class="muted">Wissensmodell: ${esc(km.title)}</p>
    <div class="progress" id="progress"></div>
    <form id="q-body" class="questionnaire" autocomplete="off"></form>
  `;
  const body = container.querySelector('#q-body');
  const progressEl = container.querySelector('#progress');

  const get = (path) => project.replies[path];
  const set = (path, value) => { project.replies[path] = value; storage.saveProject(project); };
  const clear = (path) => { delete project.replies[path]; storage.saveProject(project); };

  function updateProgress() {
    const { answered, total } = M.countProgress(km, project.replies);
    const pct = total ? Math.round((answered / total) * 100) : 0;
    progressEl.innerHTML = `
      <div class="bar"><span style="width:${pct}%"></span></div>
      <span class="muted">${answered} / ${total} beantwortet</span>`;
  }

  function draw() {
    body.innerHTML = km.chapters.map((ch) => `
      <section class="chapter">
        <h2>${esc(ch.title)}</h2>
        ${ch.text ? `<p class="muted">${esc(ch.text)}</p>` : ''}
        ${ch.questions.map((q) => viewQuestion(q, q.id)).join('')}
      </section>`).join('')
      || '<p class="muted">Dieses Wissensmodell enthält noch keine Fragen.</p>';
    updateProgress();
  }

  function viewQuestion(q, path) {
    const r = get(path);
    let html = `<div class="q">
      <label class="q-title">${esc(q.title)}</label>
      ${q.text ? `<p class="q-text muted">${esc(q.text)}</p>` : ''}`;

    if (q.type === 'value') {
      const type = INPUT_TYPE[q.valueType] || 'text';
      const err = M.validateValue(q, r?.value ?? '');
      html += `<input class="q-input${err ? ' invalid' : ''}" type="${type}" data-kind="value" data-path="${esc(path)}"
        value="${esc(r?.value ?? '')}">`;
      html += `<p class="field-error" data-error-for="${esc(path)}">${err ? esc(err) : ''}</p>`;
    } else if (q.type === 'options') {
      html += q.answers.map((a) => `
        <label class="opt">
          <input type="radio" name="${esc(path)}" value="${esc(a.id)}"
            data-kind="answer" data-path="${esc(path)}" ${r?.value === a.id ? 'checked' : ''}>
          ${esc(a.label)}
        </label>
        ${a.advice && r?.value === a.id ? `<p class="advice">💡 ${esc(a.advice)}</p>` : ''}`).join('');
      if (r?.value) {
        const a = q.answers.find((x) => x.id === r.value);
        if (a && a.followUps.length) {
          html += `<div class="followups">${
            a.followUps.map((fq) => viewQuestion(fq, `${path}.${a.id}.${fq.id}`)).join('')
          }</div>`;
        }
      }
    } else if (q.type === 'multiChoice') {
      const sel = new Set(r?.value || []);
      html += q.choices.map((c) => `
        <label class="opt">
          <input type="checkbox" value="${esc(c.id)}" data-kind="multi" data-path="${esc(path)}"
            ${sel.has(c.id) ? 'checked' : ''}>
          ${esc(c.label)}
        </label>`).join('');
    } else if (q.type === 'list') {
      const items = r?.value || [];
      html += '<div class="list">';
      items.forEach((itemId, idx) => {
        html += `<div class="list-item">
          <div class="list-item-head">
            <strong>Eintrag ${idx + 1}</strong>
            <button type="button" class="btn-sm danger" data-action="del-item"
              data-path="${esc(path)}" data-item="${esc(itemId)}">Entfernen</button>
          </div>
          ${q.itemTemplate.map((sq) => viewQuestion(sq, `${path}.${itemId}.${sq.id}`)).join('')}
        </div>`;
      });
      html += `<button type="button" class="btn-sm" data-action="add-item" data-path="${esc(path)}">+ Eintrag hinzufügen</button>`;
      html += '</div>';
    }

    return `${html}</div>`;
  }

  // --- Events (delegated on the stable form element) ---------------------
  body.addEventListener('submit', (e) => e.preventDefault());

  body.addEventListener('input', (e) => {
    const t = e.target;
    if (t.dataset.kind !== 'value') return;
    const path = t.dataset.path;
    if (t.value === '') clear(path);
    else set(path, { type: 'value', value: t.value });
    // live validation feedback without re-rendering (keeps focus)
    const err = M.validateValue(M.questionAtPath(km, path), t.value);
    t.classList.toggle('invalid', !!err);
    const errEl = body.querySelector(`[data-error-for="${CSS.escape(path)}"]`);
    if (errEl) errEl.textContent = err || '';
    updateProgress();
  });

  body.addEventListener('change', (e) => {
    const t = e.target;
    if (t.dataset.kind === 'answer') {
      set(t.dataset.path, { type: 'answer', value: t.value });
      draw(); // selection may reveal/hide follow-ups
    } else if (t.dataset.kind === 'multi') {
      const path = t.dataset.path;
      const chosen = new Set(get(path)?.value || []);
      if (t.checked) chosen.add(t.value); else chosen.delete(t.value);
      const arr = [...chosen];
      if (arr.length) set(path, { type: 'multiChoice', value: arr }); else clear(path);
      updateProgress();
    }
  });

  body.addEventListener('click', (e) => {
    const action = e.target.dataset.action;
    if (!action) return;
    const path = e.target.dataset.path;

    if (action === 'add-item') {
      const items = get(path)?.value || [];
      set(path, { type: 'itemList', value: [...items, M.uid('it')] });
      draw();
    } else if (action === 'del-item') {
      const itemId = e.target.dataset.item;
      const items = (get(path)?.value || []).filter((i) => i !== itemId);
      // drop any replies that belonged to the removed item
      const prefix = `${path}.${itemId}.`;
      for (const key of Object.keys(project.replies)) {
        if (key.startsWith(prefix)) delete project.replies[key];
      }
      if (items.length) project.replies[path] = { type: 'itemList', value: items };
      else delete project.replies[path];
      storage.saveProject(project);
      draw();
    }
  });

  draw();
}
