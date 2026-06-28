# Data Stewart Tool

Eine bewusst **vereinfachte Nachbildung des [Data Stewardship Wizard (DSW)](https://ds-wizard.org)**
als reine Client-Anwendung in **Vanilla JavaScript, HTML und CSS** — ohne Framework,
ohne Build-Schritt, ohne Backend.

> 🔗 **Live (GitHub Pages):** https://daimpad.github.io/Data-Stewardship-Tool/

Das Tool bildet die drei Kernschritte des DSW ab:

> **Wissensmodell bauen → Fragebogen ausfüllen → Dokument erzeugen.**

Eine ausführliche Konzeptbeschreibung inkl. Mapping zum Original steht in
[`ZIELBILD.md`](ZIELBILD.md); Hinweise für die Weiterentwicklung in
[`CLAUDE.md`](CLAUDE.md).

---

## Inhalt

- [Hintergrund](#hintergrund)
- [Funktionen](#funktionen)
- [Schnellstart](#schnellstart)
- [Architektur](#architektur)
- [Datenmodell](#datenmodell)
- [Fragetypen](#fragetypen)
- [Routing](#routing)
- [Projektstruktur](#projektstruktur)
- [Deployment](#deployment)
- [Grenzen & Ausblick](#grenzen--ausblick)
- [Lizenz](#lizenz)

---

## Hintergrund

Der **Data Stewardship Wizard** kommt aus dem Forschungsdatenmanagement. Sein
Kerngedanke ist die Trennung von **Inhaltsmodell** und **Ausfüllung**:
Data Stewards bauen wiederverwendbare *Wissensmodelle* (Bäume aus Kapiteln,
Fragen, Antworten), Forschende beantworten daraus einen Fragebogen, und aus den
Antworten wird ein Dokument (typisch ein Data Management Plan) erzeugt.

Das Original besteht aus einem Haskell-Backend und einem Elm-Frontend (beide als
read-only Referenz unter `engine-backend-develop/` bzw. `engine-frontend-develop/`
in diesem Repository). Das *Data Stewart Tool* kollabiert API + Datenbank in den
Browser und behält dabei die konzeptuelle Struktur bei.

## Funktionen

- **Wissensmodell-Editor** — Kapitel, Fragen und Antworten als Baum pflegen;
  verschachtelte Folgefragen, Mehrfachauswahl-Optionen und wiederholbare Listen;
  optionale **Validierungen** für Wert-Fragen (Min/Max, Länge, Regex; dazu E-Mail-/
  URL-/Zahl-Prüfung je Werttyp); Fragen als **Pflicht** markieren;
  Fragen/Kapitel umsortieren und löschen; Auto-Save.
- **Fragebogen** — das Wissensmodell wird als Formular gerendert; Folgefragen und
  Listeneinträge erscheinen dynamisch; Live-Fortschrittsanzeige. Pflichtfragen sind
  mit `*` markiert; ein Zähler zeigt, wie viele Pflichtfelder noch offen sind.
- **Dokument** — die Antworten werden als gegliedertes, druckbares HTML
  ausgegeben (Browser-Druck → „Als PDF speichern").
- **Import/Export & Duplizieren** — Wissensmodelle *und* Projekte als JSON
  exportieren und wieder importieren (zum Teilen oder Sichern; eine Mini-Variante
  des DSW-Paketgedankens). Projekte lassen sich zudem **duplizieren** (entspricht
  dem Template-Gedanken des DSW).
- **Vorlagen** — mitgelieferte, an etablierten DMP-Vorgaben orientierte
  Wissensmodelle (**Science Europe / Horizon Europe**, **DFG-Checkliste**); per
  „Übernehmen" als bearbeitbare Kopie in die eigene Bibliothek laden.
- **Referenzen & Leitfaden** — je Frage Hilfe-Links (z. B. DSGVO, FAIR,
  Repositorien) und **Markdown-Hilfetexte**; im Fragebogen und im Dokument als
  Links dargestellt. Markdown wird sicher gerendert (Escaping zuerst, nur
  erlaubte Link-Schemata).
- **Tags & Zuschnitt** — Fragen mit Tags versehen (im Editor) und pro Projekt
  Tags auswählen, um den Fragebogen zuzuschneiden: ohne Auswahl alle Fragen,
  mit Auswahl nur passend getaggte (ungetaggte bleiben immer sichtbar) — wie im DSW.
- **maDMP-Export** — den ausgefüllten Fragebogen als **RDA DMP Common Standard**
  JSON exportieren. Im Editor wird je Frage ein maDMP-Feld zugeordnet; der Exporter
  füllt daraus ein standard-nahes `dmp`-Objekt (inkl. mehrerer Datasets aus einer
  Listenfrage). Die Science-Europe-Vorlage ist beispielhaft vorgemappt.
- **Beispiel-Wissensmodell** wird beim ersten Start automatisch geladen.

## Schnellstart

ES-Module benötigen einen `http://`-Ursprung — die App also über einen
statischen Server (nicht per `file://`) öffnen:

```bash
# im Repository-Root
python3 -m http.server 8000     # oder: npx serve .
# Browser öffnen: http://localhost:8000
```

Kein `npm install`, kein Build, keine Test-Toolchain — es ist reines Browser-JS.

## Architektur

Single-Page-App in Vanilla-JS. Die Schichten spiegeln die des DSW in schlanker
Form wider:

```
index.html      App-Shell (eine Seite)
js/app.js       Bootstrap + Hash-Router (#/km, #/projects, …)
js/pages/*      Views — rendern HTML, behandeln Events      (≈ Elm "Pages")
js/models.js    Domänen-Helfer: Fabriken, IDs, Baum-Traversal, Fortschritt  (≈ "Model")
js/storage.js   Persistenzschicht                            (≈ "DAO/Service")
localStorage    JSON-Speicher                                (≈ "Datenbank")
```

**Goldene Regel:** Sämtliche Lese-/Schreibzugriffe laufen über `js/storage.js`.
Seiten und Modelle fassen `localStorage` **nie** direkt an. Dadurch bleibt ein
späterer Wechsel auf ein PHP/MySQL-Backend (Stufe 2) auf diese eine Datei
beschränkt — dieselbe API würde dann `fetch()`-Aufrufe kapseln.

## Datenmodell

Ein Wissensmodell ist **verschachteltes JSON** (statt des UUID-Graphen des DSW):

```jsonc
{
  "id": "km_ab12",
  "title": "Beispiel-Wissensmodell",
  "description": "…",
  "createdAt": "2026-06-28T10:00:00.000Z",
  "chapters": [
    { "id": "ch_01", "title": "Allgemeine Angaben", "text": "…",
      "questions": [ /* Frage-Baum */ ] }
  ]
}
```

Ein **Projekt** ist ein ausgefüllter Fragebogen. Antworten (`replies`) werden —
wie im DSW — über einen **Pfad** aus IDs adressiert (punktgetrennt):

```jsonc
{
  "id": "prj_77", "kmId": "km_ab12", "name": "DMP für Projekt XY",
  "createdAt": "…",
  "replies": {
    "q_name":                   { "type": "value",       "value": "Klimadaten 2026" },
    "q_personal":               { "type": "answer",      "value": "a_yes" },
    "q_personal.a_yes.q_legal": { "type": "value",       "value": "Einwilligung" },
    "q_storage":                { "type": "multiChoice", "value": ["c_cloud", "c_repo"] },
    "q_datasets":               { "type": "itemList",    "value": ["it_1", "it_2"] },
    "q_datasets.it_1.q_format": { "type": "value",       "value": "CSV" }
  }
}
```

**Pfad-Adressierung**
- Frage auf oberster Ebene: `q_name`
- Folgefrage unter einer Antwort: `q_personal.a_yes.q_legal` (Frage → gewählte Antwort → Folgefrage)
- Frage in einem Listeneintrag: `q_datasets.it_1.q_format` (Listenfrage → Item-ID → Unterfrage)

**Reply-Typen:** `value` (String), `answer` (ID der gewählten Antwort),
`multiChoice` (Array gewählter Choice-IDs), `itemList` (Array von Item-IDs).

## Fragetypen

Vier der sieben DSW-Fragetypen sind abgebildet:

| Typ | Bedeutung |
|-----|-----------|
| `value`       | Freitext/Zahl/Datum/E-Mail/URL (per `valueType`) |
| `options`     | Einfachauswahl; jede Antwort kann **Folgefragen** auslösen |
| `multiChoice` | Mehrfachauswahl aus festen Optionen (Checkboxen) |
| `list`        | Wiederholbare Gruppe (Item-Vorlage aus Unterfragen) |

`value`-Fragen können **Validierungen** tragen (`validations: [{ type, value }]` mit
`minLength`, `maxLength`, `pattern`, `min`, `max`); zusätzlich wird je `valueType`
das Format geprüft (Zahl/E-Mail/URL). Im Fragebogen werden ungültige Eingaben
markiert und zählen nicht als beantwortet.

Jede Frage kann **Referenzen** (`references: [{ label, url }]`, Hilfe-Links) tragen;
Hilfetexte, Hinweise und Kapitelbeschreibungen werden als sicheres Markdown
(fett, kursiv, Code, Links) gerendert.

**Tags** leben am Wissensmodell (`tags: [{ id, name, color }]`); Fragen verweisen
über `tagIds` darauf, ein Projekt wählt über `selectedTagIds` aus. Im Fragebogen,
Dokument und in der Fortschrittszählung werden ausgeblendete Fragen übersprungen.

## Routing

Hash-basiert, ohne History-API:

| Route | Seite | Zweck |
|-------|-------|-------|
| `#/km` | `js/pages/kmList.js` | Wissensmodelle auflisten/anlegen |
| `#/km/:id/edit` | `js/pages/kmEditor.js` | Kapitel, Fragen, Antworten, Listen bearbeiten |
| `#/projects` | `js/pages/projectList.js` | Projekte auflisten/anlegen |
| `#/projects/:id` | `js/pages/questionnaire.js` | Wissensmodell als Formular ausfüllen |
| `#/projects/:id/document` | `js/pages/document.js` | Antworten als druckbares HTML |

## Projektstruktur

```
README.md            diese Datei
ZIELBILD.md          Konzept / Mapping zum DSW
CLAUDE.md            Hinweise für die Weiterentwicklung
index.html           App-Shell
css/styles.css       Stylesheet (inkl. Druck-Styles)
js/app.js            Router + Bootstrap
js/storage.js        Persistenz (localStorage)
js/models.js         Domänen-Helfer
js/util.js           kleine Helfer
js/templates.js      Registry der mitgelieferten Vorlagen
js/madmp.js          maDMP-Export (RDA DMP Common Standard)
js/pages/*.js        Seiten/Views
data/sample-km.json  Beispiel-Wissensmodell (Seed)
data/templates/*.json  mitgelieferte DMP-Vorlagen (Science Europe, DFG)
.github/workflows/static.yml   GitHub-Pages-Deployment
engine-backend-develop/   Original-DSW (Haskell) — read-only Referenz
engine-frontend-develop/  Original-DSW (Elm) — read-only Referenz
```

> ⚠️ Die beiden `engine-*`-Ordner sind die unveränderten Original-Quellen des
> DSW und dienen nur als Referenz — sie werden nicht angefasst.

## Deployment

Das Tool wird bei jedem Push auf `main` automatisch nach **GitHub Pages**
deployt — siehe [`.github/workflows/static.yml`](.github/workflows/static.yml).
Der Workflow stellt ein schlankes `_site` zusammen (nur `index.html`, `css/`,
`js/`, `data/`) und veröffentlicht es; die Referenz-Ordner und Dokumente werden
nicht mitausgeliefert. Da alle Asset-Pfade relativ sind, läuft die App unter dem
Pages-Basispfad `…github.io/Data-Stewardship-Tool/`.

## Grenzen & Ausblick

Bewusst **außerhalb** dieses MVP (vgl. [`ZIELBILD.md`](ZIELBILD.md) §8):
Nutzer/Rollen, serverseitige/geteilte Persistenz, Registry/Paket-Austausch,
KM-Versionierung, Metriken, Phasen, Tags, Integrationen, Datei-Uploads,
Template-Sprache, Echtzeit-Kollaboration.

Die Persistenz liegt im Browser (`localStorage`) — also pro Gerät/Browser, ohne
Teilen. Sobald geteilte Daten oder Nutzer/Rollen nötig werden, ist das der
Auslöser für **Stufe 2**: ein Backend (dann PHP/MySQL) hinter `js/storage.js`.

## Lizenz

Apache License 2.0 — siehe [`LICENSE`](LICENSE).
