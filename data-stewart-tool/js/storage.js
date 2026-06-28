// Persistence layer — the ONLY place that talks to the data store.
//
// Today this wraps the browser's localStorage. For Stage 2 (shared data,
// users/roles) swap the bodies below for `fetch()` calls to a PHP/MySQL API;
// the rest of the app keeps using the same functions unchanged.

const KEY_KMS = 'dst.kms';
const KEY_PROJECTS = 'dst.projects';

function read(key) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? [];
  } catch {
    return [];
  }
}

function write(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function upsert(key, item) {
  const list = read(key);
  const i = list.findIndex((x) => x.id === item.id);
  if (i >= 0) list[i] = item;
  else list.push(item);
  write(key, list);
  return item;
}

// --- Knowledge Models ----------------------------------------------------
export function getKMs() { return read(KEY_KMS); }
export function getKM(id) { return getKMs().find((k) => k.id === id) || null; }
export function saveKM(km) { return upsert(KEY_KMS, km); }
export function deleteKM(id) { write(KEY_KMS, getKMs().filter((k) => k.id !== id)); }

// --- Projects ------------------------------------------------------------
export function getProjects() { return read(KEY_PROJECTS); }
export function getProject(id) { return getProjects().find((p) => p.id === id) || null; }
export function saveProject(p) { return upsert(KEY_PROJECTS, p); }
export function deleteProject(id) { write(KEY_PROJECTS, getProjects().filter((p) => p.id !== id)); }

// --- First-run seed ------------------------------------------------------
// Loads the bundled example knowledge model so the app isn't empty on first
// visit. Silently does nothing if data already exists or the file can't be
// fetched (e.g. opened via file:// without a server).
export async function seedIfEmpty() {
  if (getKMs().length > 0) return;
  try {
    const res = await fetch('./data/sample-km.json');
    if (!res.ok) return;
    saveKM(await res.json());
  } catch {
    /* offline / no server — start with an empty store */
  }
}
