# Zielbild — Data Stewart Tool (vereinfachte Abbildung des DSW)

> Eine bewusst vereinfachte Nachbildung des **Data Stewardship Wizard (DSW)** als reine
> Client-Anwendung in **Vanilla-JavaScript, HTML und CSS** — ohne Backend, ohne Build-Tooling.

---

## 1. Zweck & inhaltlicher Hintergrund

Der **Data Stewardship Wizard** kommt aus dem Forschungsdatenmanagement. Sein Kerngedanke
ist die Trennung von **Inhaltsmodell** und **Ausfüllung**:

1. Domänen-Expert:innen (Data Stewards) bauen ein wiederverwendbares **Wissensmodell**
   (Knowledge Model) — einen Baum aus Kapiteln, Fragen, Antworten und Folgefragen.
2. Forschende beantworten auf dessen Basis einen **Fragebogen** (Projekt).
3. Aus den Antworten wird per Vorlage ein **Dokument** (typischerweise ein Data
   Management Plan, DMP) erzeugt.

Diese drei Schritte sind der Kern, den das *Data Stewart Tool* abbildet:

> **Wissensmodell bauen → Fragebogen ausfüllen → Dokument erzeugen.**

Alles andere des DSW (Registry/Paket-Sharing, Versionierung per Event-Sourcing,
Mandantenfähigkeit, Echtzeit-Kollaboration, Metriken/FAIR-Scoring, Integrationen,
Jinja-Templates) ist für die vereinfachte Abbildung **bewusst weggelassen**.

### Bezug zum Original
Das Original besteht aus zwei Repos, die hier im Root liegen (und **nicht** verändert werden):

| Repo | Sprache | Inhalt |
|------|---------|--------|
| `engine-backend-develop/` | Haskell (Servant, PostgreSQL) | `wizard-server`, `registry-server` |
| `engine-frontend-develop/` | Elm 0.19 | `app-wizard`, `app-registry` |

Das *Data Stewart Tool* lebt vollständig getrennt davon im Ordner `data-stewart-tool/`.

---

## 2. Technische Entscheidung: reines JS statt LAMP/PHP

Ursprünglich war ein klassischer LAMP-Stack (PHP/MySQL) angedacht. Für den aktuellen
MVP-Umfang fällt die Entscheidung jedoch auf eine **reine Client-Anwendung**:

**Begründung**
- **Null Setup / null Abhängigkeiten** — kein Apache, MySQL, PHP; läuft über einen
  beliebigen statischen Webserver (oder lokal per `file://`, siehe unten).
- **Konzeptuelle Treue** — das DSW-Frontend ist selbst eine reiche Client-App (Elm-SPA).
  Wir kollabieren lediglich API + Datenbank in den Browser; KM-Baum, Fragebogen-Rendering
  und Dokumenterzeugung bleiben strukturell identisch.
- **Fokus auf die Domäne** statt auf Infrastruktur.

**Bewusst akzeptierte Grenze**
- Persistenz liegt im **Browser** (`localStorage`): kein Teilen zwischen Geräten/Personen,
  keine serverseitige Speicherung.

**Migrationspfad (wenn ein Backend nötig wird)**
- Sobald Stufe 2 (Nutzer/Rollen, geteilte Daten) ansteht, wird ein Backend ergänzt —
  dann **PHP/MySQL (LAMP)**.
- Damit das günstig bleibt, ist die gesamte Persistenz hinter **einer einzigen Schicht**
  (`js/storage.js`) gekapselt. Heute wrappt sie `localStorage`; später wrappt dieselbe
  API `fetch()`-Aufrufe gegen eine PHP-REST-Schnittstelle. Der Rest der App bleibt
  unverändert.

---

## 3. Architektur

Reine **Single-Page-App** in Vanilla-JS, ohne Framework und ohne Build-Schritt.
Die Schichtung spiegelt die des DSW in schlanker Form wider:

```
┌─────────────────────────────────────────────┐
│  index.html  — App-Shell (1 Seite)           │
├─────────────────────────────────────────────┤
│  js/pages/*  — Seiten/Views   ≈ Elm "Pages"  │  ← rendert HTML, behandelt Klicks
├─────────────────────────────────────────────┤
│  js/models.js — Domänen-Helfer ≈ "Model"     │  ← Fabriken, IDs, Baum-Helfer
├─────────────────────────────────────────────┤
│  js/storage.js — Persistenz   ≈ "DAO/Service"│  ← localStorage (später: PHP-API)
├─────────────────────────────────────────────┤
│  Browser localStorage  (JSON)  ≈ "Datenbank" │
└─────────────────────────────────────────────┘
```

- **Routing**: Hash-basiert (`#/km`, `#/km/:id/edit`, `#/projects`,
  `#/projects/:id`, `#/projects/:id/document`). Kein History-API nötig.
- **State**: Es gibt keinen globalen Reactive-Store. Quelle der Wahrheit ist
  `localStorage`; Seiten lesen beim Rendern und schreiben bei Änderungen zurück.
- **Kein Build**: ES-Module direkt im Browser. Start über einen statischen Server
  (ES-Module erfordern `http://`, nicht `file://`).

```bash
python3 -m http.server 8000     # im Repo-Root; oder: npx serve .
# Browser: http://localhost:8000
```

---

## 4. Datenmodell

Im DSW ist ein KM ein UUID-Graph mit getrennten Entity-Maps. Vereinfacht nutzen wir
**verschachteltes JSON** — leichter zu verstehen und ohne Datenbank gut handhabbar.

### 4.1 Knowledge Model (KM)
```jsonc
{
  "id": "km_ab12",
  "title": "Beispiel-Wissensmodell",
  "description": "Kurzbeschreibung",
  "createdAt": "2026-06-28T10:00:00.000Z",
  "chapters": [
    {
      "id": "ch_01",
      "title": "Allgemeine Angaben",
      "text": "Optionaler Einleitungstext (Markdown/Plain).",
      "questions": [ /* Frage-Baum, siehe 4.2 */ ]
    }
  ]
}
```

### 4.2 Fragen (auf 4 Typen reduziert)
Der DSW kennt 7 Fragetypen; wir bilden die **vier strukturell wichtigsten** ab:

| Typ | DSW-Pendant | Bedeutung |
|-----|-------------|-----------|
| `value`       | ValueQuestion       | Freitext/Zahl/Datum/E-Mail/URL (per `valueType`) |
| `options`     | OptionsQuestion     | Einfachauswahl; jede Antwort kann **Folgefragen** auslösen |
| `multiChoice` | MultiChoiceQuestion | Mehrfachauswahl aus festen Optionen (Checkboxen) |
| `list`        | ListQuestion        | Wiederholbare Gruppe (Item-Vorlage aus Unterfragen) |

```jsonc
// value-Frage
{
  "id": "q_name",
  "type": "value",
  "title": "Wie lautet der Projekttitel?",
  "text": "Optionaler Hilfetext",
  "valueType": "string"        // string | number | date | email | url
}

// options-Frage (mit Folgefragen je Antwort)
{
  "id": "q_personal",
  "type": "options",
  "title": "Werden personenbezogene Daten erhoben?",
  "text": null,
  "answers": [
    { "id": "a_yes", "label": "Ja", "advice": "DSGVO beachten.",
      "followUps": [ /* weitere Fragen, nur sichtbar bei dieser Antwort */ ] },
    { "id": "a_no",  "label": "Nein", "advice": null, "followUps": [] }
  ]
}

// multiChoice-Frage (Mehrfachauswahl)
{
  "id": "q_storage",
  "type": "multiChoice",
  "title": "Wo werden die Daten gespeichert?",
  "text": null,
  "choices": [
    { "id": "c_local", "label": "Lokaler Server" },
    { "id": "c_cloud", "label": "Cloud" },
    { "id": "c_repo",  "label": "Repositorium" }
  ]
}

// list-Frage (wiederholbare Item-Gruppe)
{
  "id": "q_datasets",
  "type": "list",
  "title": "Welche Datensätze entstehen?",
  "text": null,
  "itemTemplate": [ /* Fragen, die pro Listeneintrag wiederholt werden */ ]
}
```

### 4.3 Projekt (= ausgefüllter Fragebogen)
```jsonc
{
  "id": "prj_77",
  "kmId": "km_ab12",
  "name": "DMP für Projekt XY",
  "createdAt": "2026-06-28T10:30:00.000Z",
  "replies": {
    // Schlüssel = Pfad (siehe 4.4), Wert = typisierte Antwort
    "q_name":            { "type": "value",    "value": "Klimadaten 2026" },
    "q_personal":        { "type": "answer",   "value": "a_yes" },
    "q_personal.a_yes.q_legal": { "type": "value", "value": "Einwilligung" },
    "q_storage":         { "type": "multiChoice", "value": ["c_cloud", "c_repo"] },
    "q_datasets":        { "type": "itemList", "value": ["it_1", "it_2"] },
    "q_datasets.it_1.q_format": { "type": "value", "value": "CSV" }
  }
}
```

### 4.4 Pfad-Adressierung der Antworten
Wie im DSW werden Antworten über einen **Pfad** aus IDs adressiert (punktgetrennt).
Dadurch lassen sich Folgefragen und Listen-Einträge eindeutig verorten:

- Frage auf oberster Ebene: `q_name`
- Folgefrage unter einer gewählten Antwort: `q_personal.a_yes.q_legal`
  (Frage → gewählte Antwort → Folgefrage)
- Frage innerhalb eines Listen-Eintrags: `q_datasets.it_1.q_format`
  (Listenfrage → generierte Item-ID → Unterfrage)

**Reply-Typen** (analog DSW: StringReply / AnswerReply / MultiChoiceReply / ItemListReply):
- `value`       → `value` ist ein String (auch Zahlen/Daten als String gehalten)
- `answer`      → `value` ist die ID der gewählten Antwort
- `multiChoice` → `value` ist ein Array gewählter Choice-IDs
- `itemList`    → `value` ist ein Array von Item-IDs; die Felder je Item liegen als
  eigene Replies unter dem jeweiligen Item-Pfad

---

## 5. Funktionsumfang (MVP) & Seiten

| Schritt | Seite (Route) | Aufgabe | DSW-Pendant |
|---------|---------------|---------|-------------|
| **KM verwalten** | `#/km` | Liste aller Wissensmodelle, neu/duplizieren/löschen | KM-Liste |
| | `#/km/:id/edit` | Editor: Kapitel, Fragen, Antworten, Folgefragen, Listen pflegen | KM-Editor |
| **Fragebogen** | `#/projects` | Liste der Projekte, neues Projekt auf KM-Basis anlegen | Projekt-Liste |
| | `#/projects/:id` | KM-Baum als Formular rendern, Antworten speichern, Fortschritt zeigen | Questionnaire |
| **Dokument** | `#/projects/:id/document` | Antworten als gegliedertes **HTML-Dokument** rendern (druck-/speicherbar) | Document |

### UI-Flüsse (Kurzform)
- **KM-Editor**: Baum links/oben; pro Frage Typ wählen; bei `options` Antworten +
  Folgefragen verschachteln; bei `list` Item-Vorlage definieren. Speichern schreibt
  das ganze KM-JSON via `storage.js`.
- **Questionnaire**: rekursives Rendern des KM-Baums. `options` blendet die `followUps`
  der gewählten Antwort dynamisch ein; `list` erlaubt „Eintrag hinzufügen/entfernen".
  Jede Eingabe schreibt sofort eine Reply. Eine Fortschrittsanzeige zählt beantwortete
  von sichtbaren Fragen.
- **Dokument**: läuft denselben Baum ab, ersetzt Eingabefelder durch die gespeicherten
  Werte/Antwort-Labels und gibt sauberes, druckbares HTML aus (Browser-Druck → PDF
  reicht als Export).

---

## 6. Mapping: DSW → Data Stewart Tool

| DSW-Konzept | Hier abgebildet als | Vereinfachung |
|-------------|---------------------|---------------|
| Knowledge Model (UUID-Graph) | verschachteltes KM-JSON | nur Kapitel/Fragen/Antworten/Folgefragen/Listen |
| 7 Fragetypen | 4 Typen (`value`, `options`, `multiChoice`, `list`) | Integration/ItemSelect/File entfallen |
| KM-Editor (event-sourced) | direkter JSON-Editor | keine Versionierung/Events |
| Package + Registry | KM als JSON exportieren/importieren | nur Datei-Austausch, keine zentrale Registry |
| Project + Replies | Projekt-JSON mit `replies`-Map | gleiche Pfad-Logik, reduziert |
| Phasen / Metriken / Tags | — | entfallen |
| Document Template (Jinja) | fest verdrahtetes HTML-Rendering | keine Template-Sprache |
| Users / Roles / Tenants | — (Stufe 2) | erst mit Backend |
| Kollaboration (WebSockets) | — | entfällt |

---

## 7. Ordnerstruktur (Zielzustand)

Die App liegt im **Repository-Root** (neben den read-only `engine-*`-Ordnern):

```
<repo root>/
├── README.md               # technische Dokumentation (Einstieg)
├── ZIELBILD.md             # dieses Dokument
├── CLAUDE.md               # Anleitung für Claude Code
├── index.html              # App-Shell, lädt die SPA
├── css/
│   └── styles.css          # schlankes, eigenes Stylesheet
├── js/
│   ├── app.js              # Bootstrap + Hash-Router
│   ├── storage.js          # Persistenzschicht (localStorage; später PHP-API)
│   ├── models.js           # Fabriken/Helfer für KM & Projekt, IDs, Baum-Traversal, Fortschritt
│   ├── util.js             # kleine Helfer (HTML-Escaping etc.)
│   └── pages/
│       ├── kmList.js
│       ├── kmEditor.js
│       ├── projectList.js
│       ├── questionnaire.js
│       └── document.js
├── data/
│   └── sample-km.json      # Beispiel-Wissensmodell (Seed beim ersten Start)
├── .github/workflows/
│   └── static.yml          # GitHub-Pages-Deployment (Push auf main)
├── engine-backend-develop/   # Original-DSW (Haskell) — read-only Referenz
└── engine-frontend-develop/  # Original-DSW (Elm) — read-only Referenz
```

---

## 8. Bewusst außerhalb des MVP

- Nutzerkonten, Login, Rollen (admin / dataSteward / researcher) → **Stufe 2**
- Serverseitige/geteilte Persistenz, Mehrbenutzer → **Stufe 2 (dann PHP/MySQL)**
- Registry/Paket-Austausch, KM-Versionierung & -Migration
- Metriken/FAIR-Scoring, Phasen, Tags, Integrationen, Datei-Uploads
- Template-Sprache für Dokumente, weitere Exportformate (PDF/DOCX)
- Echtzeit-Kollaboration, Kommentare

---

## 9. Roadmap (mögliche Folgestufen)

1. **Stufe 1 (dieser MVP)** — Client-App: KM verwalten, Fragebogen, HTML-Dokument.
2. **Stufe 2** — Backend (PHP/MySQL) hinter `storage.js`; Nutzer & Rollen; geteilte Daten.
3. **Stufe 3 (optional)** — mehr Fragetypen, Tags/Phasen, einfache Metriken, PDF-Export,
   Import/Export von KMs als JSON (Mini-Variante des Paket-Gedankens).
