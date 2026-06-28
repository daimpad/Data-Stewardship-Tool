// Domain factories + tree helpers. No persistence here (see storage.js).

export const VALUE_TYPES = ['string', 'number', 'date', 'email', 'url'];
export const QUESTION_TYPES = ['value', 'options', 'multiChoice', 'list'];

// Short, readable, prefixed ids (e.g. "q_4f9a2k"). Uniqueness within one
// browser store is enough for this app.
export function uid(prefix) {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}`;
}

// --- Factories -----------------------------------------------------------
export function newKM() {
  return {
    id: uid('km'),
    title: 'Neues Wissensmodell',
    description: '',
    createdAt: new Date().toISOString(),
    chapters: [],
  };
}

export function newChapter() {
  return { id: uid('ch'), title: 'Neues Kapitel', text: '', questions: [] };
}

export function newQuestion(type = 'value') {
  return applyTypeDefaults({ id: uid('q'), type, title: 'Neue Frage', text: '' }, type);
}

export function newAnswer() {
  return { id: uid('a'), label: 'Antwort', advice: '', followUps: [] };
}

export function newChoice() {
  return { id: uid('c'), label: 'Option' };
}

export function newProject(kmId, name) {
  return {
    id: uid('prj'),
    kmId,
    name: name || 'Neues Projekt',
    createdAt: new Date().toISOString(),
    replies: {},
  };
}

// Keep id/title/text but (re)set the fields specific to a question type.
// Used when creating a question and when its type is changed in the editor.
export function applyTypeDefaults(q, type) {
  const next = { id: q.id, type, title: q.title, text: q.text };
  if (type === 'value') next.valueType = q.valueType || 'string';
  if (type === 'options') next.answers = q.answers || [newAnswer()];
  if (type === 'multiChoice') next.choices = q.choices || [newChoice()];
  if (type === 'list') next.itemTemplate = q.itemTemplate || [];
  return next;
}

// --- Tree walking --------------------------------------------------------
// Calls cb(questionsArray) for every array of questions in the KM:
// chapter.questions, each options-answer.followUps, each list.itemTemplate.
export function walkQuestionArrays(km, cb) {
  for (const ch of km.chapters) {
    cb(ch.questions);
    ch.questions.forEach((q) => walkQuestion(q, cb));
  }
}

function walkQuestion(q, cb) {
  if (q.type === 'options') {
    q.answers.forEach((a) => {
      cb(a.followUps);
      a.followUps.forEach((fq) => walkQuestion(fq, cb));
    });
  } else if (q.type === 'list') {
    cb(q.itemTemplate);
    q.itemTemplate.forEach((sq) => walkQuestion(sq, cb));
  }
}

// --- Finders (by unique id) ---------------------------------------------
export function findChapter(km, id) {
  return km.chapters.find((c) => c.id === id) || null;
}

export function findQuestion(km, id) {
  let found = null;
  walkQuestionArrays(km, (arr) => {
    const q = arr.find((x) => x.id === id);
    if (q) found = q;
  });
  return found;
}

export function parentArrayOfQuestion(km, id) {
  let arr = null;
  walkQuestionArrays(km, (a) => {
    if (a.some((q) => q.id === id)) arr = a;
  });
  return arr;
}

export function findAnswer(km, id) {
  let found = null;
  walkQuestionArrays(km, (arr) => arr.forEach((q) => {
    if (q.type === 'options') {
      const a = q.answers.find((x) => x.id === id);
      if (a) found = a;
    }
  }));
  return found;
}

export function findOptionsQuestionByAnswer(km, answerId) {
  let found = null;
  walkQuestionArrays(km, (arr) => arr.forEach((q) => {
    if (q.type === 'options' && q.answers.some((a) => a.id === answerId)) found = q;
  }));
  return found;
}

export function findChoice(km, id) {
  let found = null;
  walkQuestionArrays(km, (arr) => arr.forEach((q) => {
    if (q.type === 'multiChoice') {
      const c = q.choices.find((x) => x.id === id);
      if (c) found = c;
    }
  }));
  return found;
}

export function findMultiChoiceQuestionByChoice(km, choiceId) {
  let found = null;
  walkQuestionArrays(km, (arr) => arr.forEach((q) => {
    if (q.type === 'multiChoice' && q.choices.some((c) => c.id === choiceId)) found = q;
  }));
  return found;
}

// Swap an item up/down within its array (used for reordering).
export function move(arr, id, dir) {
  if (!arr) return;
  const i = arr.findIndex((x) => x.id === id);
  if (i < 0) return;
  const j = dir === 'up' ? i - 1 : i + 1;
  if (j < 0 || j >= arr.length) return;
  [arr[i], arr[j]] = [arr[j], arr[i]];
}

// --- Progress ------------------------------------------------------------
// Counts answered vs. total *visible* answerable questions, following the
// current replies (selected options reveal follow-ups; list items expand).
// The list container itself is structural and not counted.
export function countProgress(km, replies) {
  let total = 0;
  let answered = 0;

  const visit = (q, path) => {
    const r = replies[path];
    if (q.type === 'value') {
      total++;
      if (r && r.value !== '' && r.value != null) answered++;
    } else if (q.type === 'options') {
      total++;
      if (r && r.value) {
        answered++;
        const a = q.answers.find((x) => x.id === r.value);
        if (a) a.followUps.forEach((fq) => visit(fq, `${path}.${a.id}.${fq.id}`));
      }
    } else if (q.type === 'multiChoice') {
      total++;
      if (r && (r.value || []).length) answered++;
    } else if (q.type === 'list') {
      const items = (r && r.value) || [];
      items.forEach((itemId) =>
        q.itemTemplate.forEach((sq) => visit(sq, `${path}.${itemId}.${sq.id}`)));
    }
  };

  km.chapters.forEach((ch) => ch.questions.forEach((q) => visit(q, q.id)));
  return { total, answered };
}
