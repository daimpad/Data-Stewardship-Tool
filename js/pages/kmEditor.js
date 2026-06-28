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

// Set at the start of viewKM so the (module-level) question renderers can show
// the KM's tag chips without threading tags through every function signature.
let currentTags = [];

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
    } else if (f === 'r-label' || f === 'r-url') {
      const q = M.findQuestion(km, e.target.dataset.qid);
      const i = Number(e.target.dataset.idx);
      if (q && q.references && q.references[i]) q.references[i][f === 'r-label' ? 'label' : 'url'] = v;
    } else if (f === 'tag-name' || f === 'tag-color') {
      const t = (km.tags || []).find((x) => x.id === id);
      if (t) t[f === 'tag-name' ? 'name' : 'color'] = v;
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
    } else if (action === 'add-reference') {
      const q = M.findQuestion(km, id);
      if (q) (q.references ||= []).push(M.newReference());
    } else if (action === 'del-reference') {
      const q = M.findQuestion(km, e.target.dataset.qid);
      const i = Number(e.target.dataset.idx);
      if (q && q.references) q.references.splice(i, 1);
    } else if (action === 'add-tag') {
      const i = (km.tags ||= []).length;
      km.tags.push(M.newTag(i));
    } else if (action === 'del-tag') {
      M.removeTag(km, id);
    } else if (action === 'toggle-tag') {
      const q = M.findQuestion(km, e.target.dataset.qid);
      if (q) {
        const tag = e.target.dataset.tag;
        const ids = q.tagIds || [];
        q.tagIds = ids.includes(tag) ? ids.filter((t) => t !== tag) : [...ids, tag];
      }
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
  currentTags = km.tags || [];
  return `
    <div class="km-meta">
      <input class="title-input" data-field="km-title" value="${esc(km.title)}" placeholder="Titel des Wissensmodells">
      <textarea data-field="km-desc" placeholder="Beschreibung (optional)">${esc(km.description || '')}</textarea>
    </div>
    ${viewTags(km)}
    ${km.chapters.map((ch, i) => viewChapter(ch, i, km.chapters.length)).join('')}
    <button type="button" class="btn" data-action="add-chapter">+ Kapitel hinzufügen</button>
  `;
}

function viewTags(km) {
  return `
    <div class="km-tags">
      <p class="muted small">Tags — zum Zuschneiden von Fragebögen (pro Frage zuweisbar):</p>
      <div class="tag-edit-list">
        ${(km.tags || []).map((t) => `
          <span class="tag-edit">
            <input type="color" data-field="tag-color" data-id="${esc(t.id)}" value="${esc(t.color)}" title="Farbe">
            <input data-field="tag-name" data-id="${esc(t.id)}" value="${esc(t.name)}" placeholder="Tag-Name">
            <button type="button" class="btn-sm danger" data-action="del-tag" data-id="${esc(t.id)}">✕</button>
          </span>`).join('')}
      </div>
      <button type="button" class="btn-sm" data-action="add-tag">+ Tag</button>
    </div>`;
}

function viewQuestionTags(q) {
  if (!currentTags.length) return '';
  const ids = q.tagIds || [];
  return `<div class="q-tags">
    ${currentTags.map((t) => `
      <button type="button" class="tag-chip ${ids.includes(t.id) ? 'on' : ''}"
        data-action="toggle-tag" data-qid="${esc(q.id)}" data-tag="${esc(t.id)}"
        style="--tag:${esc(t.color)}">${esc(t.name)}</button>`).join('')}
  </div>`;
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
      <input class="ed-help" data-field="q-text" data-id="${esc(q.id)}" value="${esc(q.text || '')}" placeholder="Hilfetext (optional, Markdown erlaubt)">
      ${viewQuestionTags(q)}
      ${viewQuestionBody(q)}
      ${viewReferences(q)}
    </div>`;
}

function viewReferences(q) {
  return `<div class="ed-references">
    <p class="muted small">Referenzen (Hilfe-Links):</p>
    ${(q.references || []).map((r, i) => `
      <div class="ed-reference">
        <input data-field="r-label" data-qid="${esc(q.id)}" data-idx="${i}" value="${esc(r.label)}" placeholder="Bezeichnung">
        <input data-field="r-url" data-qid="${esc(q.id)}" data-idx="${i}" value="${esc(r.url)}" placeholder="https://…">
        <button type="button" class="btn-sm danger" data-action="del-reference" data-qid="${esc(q.id)}" data-idx="${i}">✕</button>
      </div>`).join('')}
    <button type="button" class="btn-sm" data-action="add-reference" data-id="${esc(q.id)}">+ Referenz</button>
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
