# Termine

Termine werden über das **Termin-Formular** gepflegt (`/intern/termin/`, Einrichtung in `docs/termin-formular.md`). Von Hand geht es auch; dann gelten die Regeln unten genauso.

Jeder Termin ist eine Datei in `src/content/termine/`, Dateiname `JJJJ-MM-TT-kurzname.md`. Jede Kursleitung ist eine Datei in `src/content/kursleitungen/<kennung>.json`. Feste Werte und Grenzen stehen an einer Stelle: `src/lib/termin-felder.ts`.

## Termin

```markdown
---
titel: "Fastenwoche im Frühling"                  # 3–120 Zeichen
leitung: ["gisela-beispiel"]                      # 1–3 Kennungen aus src/content/kursleitungen/
beginn: 2027-03-01
ende: 2027-03-07                                  # gleich beginn = eintägig; sonst ergibt sich die Zahl der Nächte
uhrzeit_beginn: "16:00"                           # eintägig: Beginn · mehrtägig: Anreise
uhrzeit_ende: "11:00"                             # eintägig: Ende   · mehrtägig: Abreise
eigener_termin: false                             # true: Anfrage ans Haus; false: Mail an die Kursleitung
anmeldung_web: "https://example.com/kurs"         # optional
kurzbeschreibung: "Sechs Tage Basenfasten …"      # Pflicht, max. 160 Zeichen; Terminliste, Google, Teilen
bild: "medien/termine/2027-03-01-fasten-a1b2c3"   # Kursbild 16:9 in R2, oder Hausbild "haus/<name>"
bild_alt: "Gruppe beim Wandern"                   # Pflicht
bild_nachweis: "Anna Muster"                      # optional; steht dann klein unter dem Bild: „Foto: …“
uebernachtung: true
verpflegung: "fasten"                             # vegetarisch | vegan | fasten | nach-absprache | keine
preis_ab: 480                                     # Übernachtung und Verpflegung ab … € p. P. (inkl. 7 % USt, steht fest dabei); nur ohne Übernachtung und ohne Verpflegung entbehrlich
kursgebuehr: 390                                  # optional
ust: 0                                            # 0 | 7 | 19, Pflicht wenn kursgebuehr
---

Ausführliche Beschreibung. Erlaubt: Absätze, Aufzählungen mit „- “, **fett**.
```

Externe Termine (`eigener_termin: false`) brauchen eine Kursleitung mit Mailadresse oder `anmeldung_web`, sonst scheitert der Build.

## Kursleitung

```json
{
  "name": "Gisela Beispiel",
  "vorstellung": "Kurzvorstellung, max. 400 Zeichen",
  "mail": "gisela@example.com",
  "foto": "medien/kursleitungen/gisela-beispiel-d4e5f6",
  "foto_alt": "Gisela Beispiel",
  "foto_nachweis": "Studio X"
}
```

`mail` und `foto_nachweis` sind optional. Der Name ist die feste Schreibweise; „Weitere Termine mit …“ vergleicht die Kennungen, nicht die Namen.

Stimmt ein Feld nicht, scheitert der Build. Der Termin geht dann nicht live, die bisherige Seite bleibt online.

## Bilder zu Terminen und Kursleitungen

- **Sie liegen nicht im Repo, sondern in Cloudflare R2** (Bucket `selbst-gemacht-medien`, Binding `MEDIEN`). Grund: Das Repo ist öffentlich, und was einmal in der Git-Historie steht, lässt sich nicht mehr wirklich löschen. In R2 ist ein gelöschtes Bild weg (Entscheidung 20.11.2026).
- Der Bildwächter (`npm run build`) bricht ab, wenn trotzdem ein Bild in `src/content/termine/` oder `src/content/kursleitungen/` liegt.
- Das Formular schneidet im Browser auf 16:9 zu und erzeugt zwei Größen (2.400 und 800 px, WebP, auf iPhones JPEG), ohne Metadaten. Der Worker prüft beim Hochladen noch einmal: Format, 16:9, Größe, keine Metadaten.
- Ausgeliefert werden sie vom Worker unter `/medien/<schlüssel>/gross` und `/medien/<schlüssel>/klein`.
- **Hausbilder** (Notlösung ohne Kursbild) liegen im Repo unter `src/assets/bilder/` und sind in `HAUSBILDER` in `src/lib/termin-felder.ts` eingetragen.

## Anzeige

- Die Terminliste zeigt die **nächsten 12 Monate**, nach Monat gegliedert. Je Termin: Datum mit Wochentag fett, Uhrzeit, Titel, Dauer, Leitung, Kurzbeschreibung.
- Jeder Termin bekommt eine eigene Seite unter `/termine/<dateiname>/` mit Veranstaltungsdaten für Suchmaschinen (schema.org/Event) und steht, solange er nicht vorbei ist, in der Sitemap.
- Vergangene Termine blendet die Seite im Browser aus (Datum nach deutscher Zeit). Aus der Sitemap fallen sie beim nächsten Build heraus.
