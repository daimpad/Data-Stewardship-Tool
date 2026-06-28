# CLAUDE.md

Guidance for Claude Code (claude.ai/code) when working in **`data-stewart-tool/`**.

## ⚠️ Hard boundary

This project lives **only** inside `data-stewart-tool/`. The sibling folders
`engine-backend-develop/` and `engine-frontend-develop/` are the original
Data Stewardship Wizard source and are **read-only references** — never add to,
edit, or delete anything inside them.

## Project overview

**Data Stewart Tool** — a deliberately simplified reimagining of the
**Data Stewardship Wizard (DSW)** as a pure client-side app
(Vanilla JavaScript + HTML + CSS, no framework, no build step, no backend).

It covers the DSW's three core steps:

> **Build a knowledge model → fill out a questionnaire → generate a document.**

The full vision, data model, and DSW-mapping live in [`ZIELBILD.md`](ZIELBILD.md) —
read it before making structural changes.

## Run

ES modules require an `http://` origin, so serve the folder statically:

```bash
cd data-stewart-tool
python3 -m http.server 8000     # or: npx serve .
# open http://localhost:8000
```

No install, no build, no tests tooling — it is plain browser JS.

## Architecture (layers mirror the DSW in slim form)

```
index.html      App shell (single page)
js/app.js       Bootstrap + hash router (#/km, #/projects, ...)
js/pages/*      Views — render HTML, handle events     (≈ Elm "Pages")
js/models.js    Domain helpers: factories, ids, tree walking  (≈ "Model")
js/storage.js   Persistence layer                       (≈ "DAO/Service")
localStorage    JSON storage                             (≈ "Database")
```

**Golden rule:** all reads/writes go through `js/storage.js`. Pages and models
must never touch `localStorage` directly. This keeps a future swap to a
PHP/MySQL backend (Stage 2) confined to that one file.

## Data model (summary — full shapes in ZIELBILD.md §4)

- **Knowledge Model**: nested JSON — `chapters[] → questions[] → answers[] → followUps[]`.
- **Question types** (3 only): `value`, `options`, `list`.
- **Project**: `{ kmId, name, replies }` where `replies` is a map keyed by a
  dotted **path** of ids (e.g. `q_personal.a_yes.q_legal`).
- **Reply types**: `value` (string), `answer` (answer id), `itemList` (array of item ids).

## Conventions

- **Vanilla JS, ES modules** (`import`/`export`); no external runtime dependencies.
- **No build tooling** — code must run as-is in a modern browser.
- IDs are short prefixed strings: `km_`, `ch_`, `q_`, `a_`, `it_`, `prj_`
  (generated in `models.js`). Never reuse an id across entities.
- Keep rendering functions pure-ish: take state, return/inject HTML, then bind events.
- Match the existing file's style; prefer small, readable functions over cleverness.

## Routing map

| Route | Page module | Purpose |
|-------|-------------|---------|
| `#/km` | `pages/kmList.js` | list / create knowledge models |
| `#/km/:id/edit` | `pages/kmEditor.js` | edit chapters, questions, answers, lists |
| `#/projects` | `pages/projectList.js` | list / create projects |
| `#/projects/:id` | `pages/questionnaire.js` | render KM as a form, store replies |
| `#/projects/:id/document` | `pages/document.js` | render answers as printable HTML |

## Out of scope (see ZIELBILD.md §8)

Users/roles, server persistence, registry/packages, KM versioning, metrics,
phases, tags, integrations, file uploads, template language, real-time
collaboration. Don't add these without an explicit request — they belong to
later stages.

## Git

Develop on branch `claude/data-stewart-tool-arch-ujs7nh`. Commit with clear
messages; push to that branch only.
