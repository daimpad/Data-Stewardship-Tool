// Page: render a project's answers as a clean, printable HTML document.
// Browser print (Ctrl/Cmd+P) → "Save as PDF" is the export path.

import * as storage from '../storage.js';
import { esc, notFound } from '../util.js';

const unanswered = '<span class="muted">— nicht beantwortet —</span>';

export function render(container, params) {
  const project = storage.getProject(params.id);
  if (!project) { container.innerHTML = notFound('Projekt'); return; }
  const km = storage.getKM(project.kmId);
  if (!km) { container.innerHTML = '<p>Das zugehörige Wissensmodell wurde nicht gefunden.</p>'; return; }

  const replies = project.replies;

  function renderAnswer(q, path) {
    const r = replies[path];
    let out = `<div class="doc-q"><div class="doc-question">${esc(q.title)}</div>`;

    if (q.type === 'value') {
      out += `<div class="doc-answer">${r && r.value !== '' ? esc(r.value) : unanswered}</div>`;
    } else if (q.type === 'options') {
      const a = r && r.value ? q.answers.find((x) => x.id === r.value) : null;
      out += `<div class="doc-answer">${a ? esc(a.label) : unanswered}</div>`;
      if (a && a.followUps.length) {
        out += `<div class="doc-sub">${
          a.followUps.map((fq) => renderAnswer(fq, `${path}.${a.id}.${fq.id}`)).join('')
        }</div>`;
      }
    } else if (q.type === 'multiChoice') {
      const labels = (r?.value || [])
        .map((id) => q.choices.find((c) => c.id === id)?.label)
        .filter(Boolean);
      out += labels.length
        ? `<ul class="doc-answer">${labels.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>`
        : `<div class="doc-answer">${unanswered}</div>`;
    } else if (q.type === 'list') {
      const items = r?.value || [];
      if (items.length) {
        out += `<div class="doc-sub">${items.map((itemId, i) => `
          <div class="doc-item">
            <div class="doc-item-title">Eintrag ${i + 1}</div>
            ${q.itemTemplate.map((sq) => renderAnswer(sq, `${path}.${itemId}.${sq.id}`)).join('')}
          </div>`).join('')}</div>`;
      } else {
        out += `<div class="doc-answer">${unanswered}</div>`;
      }
    }

    return `${out}</div>`;
  }

  container.innerHTML = `
    <div class="page-head no-print">
      <a class="back" href="#/projects/${esc(project.id)}">← Zurück zum Fragebogen</a>
      <button type="button" class="btn" id="print-btn">Drucken / als PDF speichern</button>
    </div>
    <article class="document">
      <h1>${esc(project.name)}</h1>
      <p class="muted">Erstellt aus Wissensmodell: ${esc(km.title)}</p>
      ${km.chapters.map((ch) => `
        <section>
          <h2>${esc(ch.title)}</h2>
          ${ch.text ? `<p>${esc(ch.text)}</p>` : ''}
          ${ch.questions.map((q) => renderAnswer(q, q.id)).join('')}
        </section>`).join('')}
    </article>
  `;

  container.querySelector('#print-btn').addEventListener('click', () => window.print());
}
