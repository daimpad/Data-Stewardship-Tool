// Page: edit a knowledge model — chapters, questions (4 types), answers with
// follow-ups, multi-choice options, and list item templates.
//
// Pattern: text inputs save on `input` WITHOUT redrawing (to keep focus);
// structural changes (add/delete/move/change-type) save and redraw.

import * as storage from '../storage.js';
import * as M from '../models.js';
import { esc, notFound } from '../util.js';

const TYPE_LABELS = {
  value: 'Wert (Text/Zahl/…)',
  options: 'Einfachauswahl',
  multiChoice: 'Mehrfachauswahl',
  list: 'Liste',
};

export function render(container, params) {
  const km = storage.getKM(params.id);
  if (!km) { container.innerHTML = notFound('Wissensmodell'); return; }

  container.innerHTML = `
    <div class="page-head no-print">
      <a class="back" href="#/km">← Wissensmodelle</a>
      <span class="muted small">Änderungen werden automatisch gespeichert</span>
    </div>
    <div id="editor"></div>
  `;
  const editor = container.querySelector('#editor');

  const save = () => storage.saveKM(km);
  const draw = () => { editor.innerHTML = viewKM(km); };

  // --- text edits (no redraw) -------------------------------------------
  editor.addEventListener('input', (e) => {
    const f = e.target.dataset.field;
    if (!f) return;
    const id = e.target.dataset.id;
    const v = e.target.value;
    if (f === 'km-title') km.title = v;
    else if (f === 'km-desc') km.description = v;
    else if (f === 'ch-title') { const c = M.findChapter(km, id); if (c) c.title = v; }
    else if (f === 'ch-text') { const c = M.findChapter(km, id); if (c) c.text = v; }
    else if (f === 'q-title') { const q = M.findQuestion(km, id); if (q) q.title = v; }
    else if (f === 'q-text') { const q = M.findQuestion(km, id); if (q) q.text = v; }
    else if (f === 'a-label') { const a = M.findAnswer(km, id); if (a) a.label = v; }
    else if (f === 'a-advice') { const a = M.findAnswer(km, id); if (a) a.advice = v; }
    else if (f === 'c-label') { const c = M.findChoice(km, id); if (c) c.label = v; }
    else if (f === 'v-value') {
      const q = M.findQuestion(km, e.target.dataset.qid);
      const i = Number(e.target.dataset.idx);
      if (q && q.validations && q.validations[i]) q.validations[i].value = v;
    } else return;
    save();
  });

  // --- select changes ----------------------------------------------------
  editor.addEventListener('change', (e) => {
    const f = e.target.dataset.field;
    const id = e.target.dataset.id;
    if (f === 'q-type') {
      const arr = M.parentArrayOfQuestion(km, id);
      if (arr) {
        const i = arr.findIndex((x) => x.id === id);
        arr[i] = M.applyTypeDefaults(arr[i], e.target.value);
      }
      save();
      draw();
    } else if (f === 'q-valuetype') {
      const q = M.findQuestion(km, id);
      if (q) q.valueType = e.target.value;
      save();
    } else if (f === 'v-type') {
      const q = M.findQuestion(km, e.target.dataset.qid);
      const i = Number(e.target.dataset.idx);
      if (q && q.validations && q.validations[i]) q.validations[i].type = e.target.value;
      save();
    } else if (f === 'q-required') {
      const q = M.findQuestion(km, id);
      if (q) { if (e.target.checked) q.required = true; else delete q.required; }
      save();
    }
  });

  // --- structural buttons (redraw) --------------------------------------
  editor.addEventListener('click', (e) => {
    const action = e.target.dataset.action;
    if (!action) return;
    const id = e.target.dataset.id;

    if (action === 'add-chapter') {
      km.chapters.push(M.newChapter());
    } else if (action === 'del-chapter') {
      if (!confirm('Kapitel mit allen Fragen löschen?')) return;
      km.chapters = km.chapters.filter((c) => c.id !== id);
    } else if (action === 'move-chapter') {
      M.move(km.chapters, id, e.target.dataset.dir);
    } else if (action === 'add-question') {
      const q = M.newQuestion('value');
      const target = e.target.dataset.target;
      if (target === 'chapter') M.findChapter(km, id).questions.push(q);
      else if (target === 'answer') M.findAnswer(km, id).followUps.push(q);
      else if (target === 'list') M.findQuestion(km, id).itemTemplate.push(q);
    } else if (action === 'del-question') {
      if (!confirm('Frage löschen?')) return;
      const arr = M.parentArrayOfQuestion(km, id);
      if (arr) arr.splice(arr.findIndex((x) => x.id === id), 1);
    } else if (action === 'move-question') {
      M.move(M.parentArrayOfQuestion(km, id), id, e.target.dataset.dir);
    } else if (action === 'add-answer') {
      M.findQuestion(km, id).answers.push(M.newAnswer());
    } else if (action === 'del-answer') {
      const q = M.findOptionsQuestionByAnswer(km, id);
      if (q) q.answers = q.answers.filter((a) => a.id !== id);
    } else if (action === 'add-choice') {
      M.findQuestion(km, id).choices.push(M.newChoice());
    } else if (action === 'del-choice') {
      const q = M.findMultiChoiceQuestionByChoice(km, id);
      if (q) q.choices = q.choices.filter((c) => c.id !== id);
    } else if (action === 'add-validation') {
      const q = M.findQuestion(km, id);
      if (q) (q.validations ||= []).push(M.newValidation());
    } else if (action === 'del-validation') {
      const q = M.findQuestion(km, e.target.dataset.qid);
      const i = Number(e.target.dataset.idx);
      if (q && q.validations) q.validations.splice(i, 1);
    } else {
      return;
    }
    save();
    draw();
  });

  draw();
}

// --- rendering (returns HTML strings) ------------------------------------
function moveButtons(action, id, idx, total) {
  return `
    <button type="button" class="btn-sm secondary" data-action="${action}" data-id="${esc(id)}" data-dir="up" ${idx === 0 ? 'disabled' : ''}>↑</button>
    <button type="button" class="btn-sm secondary" data-action="${action}" data-id="${esc(id)}" data-dir="down" ${idx === total - 1 ? 'disabled' : ''}>↓</button>`;
}

function viewKM(km) {
  return `
    <div class="km-meta">
      <input class="title-input" data-field="km-title" value="${esc(km.title)}" placeholder="Titel des Wissensmodells">
      <textarea data-field="km-desc" placeholder="Beschreibung (optional)">${esc(km.description || '')}</textarea>
    </div>
    ${km.chapters.map((ch, i) => viewChapter(ch, i, km.chapters.length)).join('')}
    <button type="button" class="btn" data-action="add-chapter">+ Kapitel hinzufügen</button>
  `;
}

function viewChapter(ch, idx, total) {
  return `
    <section class="ed-chapter">
      <div class="ed-row">
        <input class="ed-title" data-field="ch-title" data-id="${esc(ch.id)}" value="${esc(ch.title)}" placeholder="Kapiteltitel">
        <span class="ed-tools">
          ${moveButtons('move-chapter', ch.id, idx, total)}
          <button type="button" class="btn-sm danger" data-action="del-chapter" data-id="${esc(ch.id)}">✕</button>
        </span>
      </div>
      <textarea class="ed-help" data-field="ch-text" data-id="${esc(ch.id)}" placeholder="Einleitungstext (optional)">${esc(ch.text || '')}</textarea>
      <div class="ed-questions">
        ${ch.questions.map((q, i) => viewQuestion(q, i, ch.questions.length)).join('')}
      </div>
      <button type="button" class="btn-sm" data-action="add-question" data-target="chapter" data-id="${esc(ch.id)}">+ Frage</button>
    </section>`;
}

function viewQuestion(q, idx, total) {
  return `
    <div class="ed-question">
      <div class="ed-row">
        <select class="ed-type" data-field="q-type" data-id="${esc(q.id)}">
          ${Object.entries(TYPE_LABELS).map(([v, l]) =>
            `<option value="${v}" ${v === q.type ? 'selected' : ''}>${l}</option>`).join('')}
        </select>
        <input class="ed-title grow" data-field="q-title" data-id="${esc(q.id)}" value="${esc(q.title)}" placeholder="Fragetext">
        <label class="req-toggle" title="Pflichtfrage">
          <input type="checkbox" data-field="q-required" data-id="${esc(q.id)}" ${q.required ? 'checked' : ''}> Pflicht
        </label>
        <span class="ed-tools">
          ${moveButtons('move-question', q.id, idx, total)}
          <button type="button" class="btn-sm danger" data-action="del-question" data-id="${esc(q.id)}">✕</button>
        </span>
      </div>
      <input class="ed-help" data-field="q-text" data-id="${esc(q.id)}" value="${esc(q.text || '')}" placeholder="Hilfetext (optional)">
      ${viewQuestionBody(q)}
    </div>`;
}

function viewValidation(v, qId, idx) {
  return `
    <div class="ed-validation">
      <select data-field="v-type" data-qid="${esc(qId)}" data-idx="${idx}">
        ${M.VALIDATION_TYPES.map((t) =>
          `<option value="${t}" ${t === v.type ? 'selected' : ''}>${M.VALIDATION_LABELS[t]}</option>`).join('')}
      </select>
      <input data-field="v-value" data-qid="${esc(qId)}" data-idx="${idx}" value="${esc(v.value)}" placeholder="Wert">
      <button type="button" class="btn-sm danger" data-action="del-validation" data-qid="${esc(qId)}" data-idx="${idx}">✕</button>
    </div>`;
}

function viewQuestionBody(q) {
  if (q.type === 'value') {
    return `<div class="ed-body">
      <label>Werttyp:
        <select data-field="q-valuetype" data-id="${esc(q.id)}">
          ${M.VALUE_TYPES.map((v) => `<option value="${v}" ${q.valueType === v ? 'selected' : ''}>${v}</option>`).join('')}
        </select>
      </label>
      <div class="ed-validations">
        <p class="muted small">Validierungen:</p>
        ${(q.validations || []).map((v, i) => viewValidation(v, q.id, i)).join('')}
        <button type="button" class="btn-sm" data-action="add-validation" data-id="${esc(q.id)}">+ Validierung</button>
      </div>
    </div>`;
  }
  if (q.type === 'options') {
    return `<div class="ed-body">
      ${q.answers.map((a) => viewAnswer(a)).join('')}
      <button type="button" class="btn-sm" data-action="add-answer" data-id="${esc(q.id)}">+ Antwort</button>
    </div>`;
  }
  if (q.type === 'multiChoice') {
    return `<div class="ed-body">
      ${q.choices.map((c) => `
        <div class="ed-choice">
          <input data-field="c-label" data-id="${esc(c.id)}" value="${esc(c.label)}" placeholder="Option">
          <button type="button" class="btn-sm danger" data-action="del-choice" data-id="${esc(c.id)}">✕</button>
        </div>`).join('')}
      <button type="button" class="btn-sm" data-action="add-choice" data-id="${esc(q.id)}">+ Option</button>
    </div>`;
  }
  if (q.type === 'list') {
    return `<div class="ed-body ed-list">
      <p class="muted small">Item-Vorlage — diese Fragen werden je Listeneintrag wiederholt:</p>
      <div class="ed-questions">
        ${q.itemTemplate.map((sq, i) => viewQuestion(sq, i, q.itemTemplate.length)).join('')}
      </div>
      <button type="button" class="btn-sm" data-action="add-question" data-target="list" data-id="${esc(q.id)}">+ Frage zur Vorlage</button>
    </div>`;
  }
  return '';
}

function viewAnswer(a) {
  return `
    <div class="ed-answer">
      <div class="ed-row">
        <input class="grow" data-field="a-label" data-id="${esc(a.id)}" value="${esc(a.label)}" placeholder="Antwort">
        <button type="button" class="btn-sm danger" data-action="del-answer" data-id="${esc(a.id)}">✕</button>
      </div>
      <input class="ed-help" data-field="a-advice" data-id="${esc(a.id)}" value="${esc(a.advice || '')}" placeholder="Hinweis bei dieser Antwort (optional)">
      <div class="ed-followups">
        <p class="muted small">Folgefragen bei dieser Antwort:</p>
        ${a.followUps.map((fq, i) => viewQuestion(fq, i, a.followUps.length)).join('')}
        <button type="button" class="btn-sm" data-action="add-question" data-target="answer" data-id="${esc(a.id)}">+ Folgefrage</button>
      </div>
    </div>`;
}
