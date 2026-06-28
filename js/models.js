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

export function newReference() {
  return { label: '', url: '' };
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

// Deep-copy a project under a new id (for "duplicate"). Replies are plain JSON.
export function duplicateProject(p) {
  const copy = JSON.parse(JSON.stringify(p));
  copy.id = uid('prj');
  copy.name = `${p.name} (Kopie)`;
  copy.createdAt = new Date().toISOString();
  return copy;
}

// Keep id/title/text but (re)set the fields specific to a question type.
// Used when creating a question and when its type is changed in the editor.
export function applyTypeDefaults(q, type) {
  const next = { id: q.id, type, title: q.title, text: q.text };
  if (q.required) next.required = true; // type-independent, preserve across type changes
  if (q.references) next.references = q.references;
  if (type === 'value') {
    next.valueType = q.valueType || 'string';
    next.validations = q.validations || [];
  }
  if (type === 'options') next.answers = q.answers || [newAnswer()];
  if (type === 'multiChoice') next.choices = q.choices || [newChoice()];
  if (type === 'list') next.itemTemplate = q.itemTemplate || [];
  return next;
}

// Validations for value questions (subset of the DSW's QuestionValidation).
export const VALIDATION_TYPES = ['minLength', 'maxLength', 'pattern', 'min', 'max'];
export const VALIDATION_LABELS = {
  minLength: 'Min. Länge',
  maxLength: 'Max. Länge',
  pattern: 'Muster (Regex)',
  min: 'Min. Wert',
  max: 'Max. Wert',
};

export function newValidation(type = 'minLength') {
  return { type, value: type === 'pattern' ? '' : 0 };
}

// Validate a raw value-question answer. Returns an error message (string) or
// null if valid. An empty value is treated as "unanswered", not an error.
export function validateValue(q, raw) {
  const v = (raw ?? '').toString();
  if (v === '') return null;

  const vt = q.valueType || 'string';
  if (vt === 'number' && Number.isNaN(Number(v))) return 'Bitte eine Zahl eingeben.';
  if (vt === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return 'Bitte eine gültige E-Mail-Adresse eingeben.';
  if (vt === 'url') { try { new URL(v); } catch { return 'Bitte eine gültige URL eingeben.'; } }

  for (const rule of q.validations || []) {
    const n = Number(rule.value);
    if (rule.type === 'minLength' && v.length < n) return `Mindestens ${n} Zeichen.`;
    if (rule.type === 'maxLength' && v.length > n) return `Höchstens ${n} Zeichen.`;
    if (rule.type === 'min' && Number(v) < n) return `Mindestwert ${n}.`;
    if (rule.type === 'max' && Number(v) > n) return `Höchstwert ${n}.`;
    if (rule.type === 'pattern' && rule.value) {
      let re = null;
      try { re = new RegExp(rule.value); } catch { re = null; }
      if (re && !re.test(v)) return `Entspricht nicht dem Muster: ${rule.value}`;
    }
  }
  return null;
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

// Resolve the question object that a reply path points at. Path segments
// alternate question-id / (answer-id | item-id) / question-id / ...
export function questionAtPath(km, path) {
  const seg = path.split('.');
  let pool = km.chapters.flatMap((c) => c.questions);
  let q = null;
  for (let i = 0; i < seg.length; i += 2) {
    q = pool.find((x) => x.id === seg[i]);
    if (!q) return null;
    if (i + 1 < seg.length) {
      if (q.type === 'options') {
        const a = q.answers.find((x) => x.id === seg[i + 1]);
        pool = a ? a.followUps : [];
      } else if (q.type === 'list') {
        pool = q.itemTemplate; // seg[i+1] is an item id; sub-questions are the template
      } else {
        return null;
      }
    }
  }
  return q;
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
// Also tracks required questions: requiredTotal and requiredOpen (visible
// required questions that are not yet satisfactorily answered).
// The list container itself is structural and not counted in total/answered.
export function countProgress(km, replies) {
  let total = 0;
  let answered = 0;
  let requiredTotal = 0;
  let requiredOpen = 0;

  const tally = (q, done) => {
    if (q.required) {
      requiredTotal++;
      if (!done) requiredOpen++;
    }
  };

  const visit = (q, path) => {
    const r = replies[path];
    if (q.type === 'value') {
      total++;
      const done = !!r && r.value !== '' && r.value != null && validateValue(q, r.value) === null;
      if (done) answered++;
      tally(q, done);
    } else if (q.type === 'options') {
      total++;
      const done = !!(r && r.value);
      if (done) {
        answered++;
        const a = q.answers.find((x) => x.id === r.value);
        if (a) a.followUps.forEach((fq) => visit(fq, `${path}.${a.id}.${fq.id}`));
      }
      tally(q, done);
    } else if (q.type === 'multiChoice') {
      total++;
      const done = !!(r && (r.value || []).length);
      if (done) answered++;
      tally(q, done);
    } else if (q.type === 'list') {
      const items = (r && r.value) || [];
      tally(q, items.length > 0); // a required list needs at least one entry
      items.forEach((itemId) =>
        q.itemTemplate.forEach((sq) => visit(sq, `${path}.${itemId}.${sq.id}`)));
    }
  };

  km.chapters.forEach((ch) => ch.questions.forEach((q) => visit(q, q.id)));
  return { total, answered, requiredTotal, requiredOpen };
}
