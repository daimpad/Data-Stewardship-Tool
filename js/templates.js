// Bundled, ready-to-use knowledge models based on established DMP guidance.
// Each entry's `file` is fetched on demand when the user adds it to the library.
export const TEMPLATES = [
  {
    id: 'science-europe',
    title: 'Science Europe DMP (international)',
    description: 'Datenmanagementplan nach den sechs Kernthemen des Science-Europe-Leitfadens — Basis u. a. für Horizon-Europe-DMPs.',
    file: './data/templates/science-europe.json',
  },
  {
    id: 'dfg-checkliste',
    title: 'DFG-Checkliste „Umgang mit Forschungsdaten"',
    description: 'Kompakte Vorlage angelehnt an die DFG-Checkliste zum Umgang mit Forschungsdaten in Förderanträgen.',
    file: './data/templates/dfg-checkliste.json',
  },
];
