// Export a project's answers as RDA DMP Common Standard (maDMP) JSON.
//
// Driven by per-question `madmpField` mappings set in the editor. This covers
// the core fields of the standard and is structurally aligned with it; it is
// not a full JSON-Schema validation. See https://github.com/RDA-DMP-Common.

// Fields a question's answer can be mapped to (shown in the editor dropdown).
export const MADMP_FIELDS = [
  { key: '', label: '— kein maDMP-Feld —' },
  { key: 'dmp.title', label: 'DMP: Titel' },
  { key: 'dmp.description', label: 'DMP: Beschreibung' },
  { key: 'contact.name', label: 'Kontakt: Name' },
  { key: 'contact.mbox', label: 'Kontakt: E-Mail' },
  { key: 'project.title', label: 'Projekt: Titel' },
  { key: 'project.start', label: 'Projekt: Start (Datum)' },
  { key: 'project.end', label: 'Projekt: Ende (Datum)' },
  { key: 'ethical_issues_exist', label: 'Ethik: Probleme vorhanden? (ja/nein)' },
  { key: 'dataset[]', label: 'Datensätze (Liste → je Eintrag ein Dataset)' },
  { key: 'dataset.title', label: 'Dataset: Titel' },
  { key: 'dataset.personal_data', label: 'Dataset: personenbezogen? (ja/nein)' },
  { key: 'dataset.sensitive_data', label: 'Dataset: sensibel? (ja/nein)' },
  { key: 'distribution.data_access', label: 'Distribution: Zugriff (open/shared/closed)' },
  { key: 'distribution.license', label: 'Distribution: Lizenz' },
  { key: 'distribution.host', label: 'Distribution: Repositorium/Host' },
  { key: 'distribution.format', label: 'Distribution: Format' },
];

function yesNo(s) {
  const l = (s || '').toLowerCase();
  if (l.startsWith('ja') || l === 'yes' || l.startsWith('liegt vor') || l.startsWith('erforderlich')) return 'yes';
  if (l.startsWith('nein') || l === 'no' || l.startsWith('nicht')) return 'no';
  return 'unknown';
}

function access(s) {
  const l = (s || '').toLowerCase();
  if (l.includes('open') || l.includes('offen') || l.startsWith('ja')) return 'open';
  if (l.includes('shared') || l.includes('eingeschr') || l.includes('teil') || l.includes('restrict')) return 'shared';
  if (l.includes('closed') || l.includes('geschlossen') || l.startsWith('nein')) return 'closed';
  return '';
}

// Human-readable value of a question's reply (label for options/choices).
function rawValue(q, reply) {
  if (!reply) return '';
  if (q.type === 'value') return reply.value || '';
  if (q.type === 'options') return (q.answers.find((a) => a.id === reply.value) || {}).label || '';
  if (q.type === 'multiChoice') {
    return (reply.value || [])
      .map((id) => (q.choices.find((c) => c.id === id) || {}).label)
      .filter(Boolean).join(', ');
  }
  return '';
}

// Walk the KM tree following replies, collecting mapped values.
function collect(km, replies) {
  const scalar = {};            // dmp.*/contact.*/project.*/ethical_issues_exist
  const datasetDefaults = {};   // dataset.*/distribution.* found outside a dataset[] list
  let datasetItems = null;      // per-item field maps if a dataset[] list exists

  const record = (q, path) => {
    const f = q.madmpField;
    if (!f || f === 'dataset[]') return;
    const val = rawValue(q, replies[path]);
    if (f.startsWith('dataset.') || f.startsWith('distribution.')) datasetDefaults[f] = val;
    else scalar[f] = val;
  };

  const visit = (q, path, inList) => {
    if (q.type === 'list' && q.madmpField === 'dataset[]' && !inList && !datasetItems) {
      const items = (replies[path] && replies[path].value) || [];
      datasetItems = items.map((itemId) => {
        const fields = {};
        q.itemTemplate.forEach((sq) => {
          if (sq.madmpField) fields[sq.madmpField] = rawValue(sq, replies[`${path}.${itemId}.${sq.id}`]);
        });
        return fields;
      });
      return; // this list defines datasets; don't collect it as scalar
    }
    record(q, path);
    if (q.type === 'options') {
      const r = replies[path];
      if (r && r.value) {
        const a = q.answers.find((x) => x.id === r.value);
        if (a) a.followUps.forEach((fq) => visit(fq, `${path}.${a.id}.${fq.id}`, inList));
      }
    } else if (q.type === 'list') {
      const items = (replies[path] && replies[path].value) || [];
      items.forEach((itemId) => q.itemTemplate.forEach((sq) => visit(sq, `${path}.${itemId}.${sq.id}`, true)));
    }
  };

  km.chapters.forEach((ch) => ch.questions.forEach((q) => visit(q, q.id, false)));
  return { scalar, datasetDefaults, datasetItems };
}

function buildDataset(fields, index, projectName, startDate) {
  const get = (k) => fields[k] || '';
  const title = get('dataset.title') || `${projectName} – Datensatz ${index + 1}`;
  const ds = {
    dataset_id: { identifier: `ds-${index + 1}`, type: 'other' },
    title,
    personal_data: get('dataset.personal_data') ? yesNo(get('dataset.personal_data')) : 'unknown',
    sensitive_data: get('dataset.sensitive_data') ? yesNo(get('dataset.sensitive_data')) : 'unknown',
  };
  const license = get('distribution.license');
  const host = get('distribution.host');
  const format = get('distribution.format');
  const acc = access(get('distribution.data_access'));
  if (license || host || format || acc) {
    const dist = { title: `Distribution: ${title}`, data_access: acc || 'open' };
    if (format) dist.format = [format];
    if (license) dist.license = [{ license_ref: license, start_date: startDate }];
    if (host) dist.host = { title: host };
    ds.distribution = [dist];
  }
  return ds;
}

export function toMaDmp(km, project) {
  const replies = project.replies || {};
  const { scalar, datasetDefaults, datasetItems } = collect(km, replies);
  const now = new Date().toISOString();
  const created = project.createdAt || now;
  const startDate = created.slice(0, 10);
  const sval = (k) => scalar[k] || '';

  const mbox = sval('contact.mbox');
  const contact = {
    name: sval('contact.name') || 'Unbekannt',
    contact_id: { identifier: mbox || 'unknown', type: 'other' },
  };
  if (mbox) contact.mbox = mbox;

  let datasets;
  if (datasetItems && datasetItems.length) {
    datasets = datasetItems.map((f, i) => buildDataset({ ...datasetDefaults, ...f }, i, project.name, startDate));
  } else {
    datasets = [buildDataset(datasetDefaults, 0, project.name, startDate)];
  }

  const dmp = {
    title: sval('dmp.title') || project.name,
    language: 'deu',
    created,
    modified: now,
    dmp_id: { identifier: project.id, type: 'other' },
    contact,
    dataset: datasets,
  };
  if (sval('dmp.description')) dmp.description = sval('dmp.description');
  if (sval('ethical_issues_exist')) dmp.ethical_issues_exist = yesNo(sval('ethical_issues_exist'));

  const pTitle = sval('project.title');
  const pStart = sval('project.start');
  const pEnd = sval('project.end');
  if (pTitle || pStart || pEnd) {
    const proj = { title: pTitle || project.name };
    if (pStart) proj.start = pStart;
    if (pEnd) proj.end = pEnd;
    dmp.project = [proj];
  }

  return { dmp };
}
