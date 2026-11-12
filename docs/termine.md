# Termine

Jeder Termin ist eine Datei in `src/content/termine/`, Dateiname `JJJJ-MM-kurzname.md`.

```markdown
---
titel: "Fastenwoche im Frühling"
kategorie: kurs            # veranstaltung | kurs | retreat | das-laeuft-bei-uns
leitung: "Gisela Schieferdecker"
beginn: 2027-03-01
ende: 2027-03-07
naechte: 6
kursgebuehr: "390 € zzgl. Übernachtung"   # optional
eigener_termin: false      # true: Anfrage ans Haus; false: Kontakt der Kursleitung
kontakt_mail: "name@example.com"         # Pflicht bei externen Terminen (oder kontakt_web)
kontakt_web: "https://example.com"       # optional
beschreibung: "Fünf Tage Basenfasten mit Wandern …"   # optional, max. 160 Zeichen; sonst automatisch
bild: "./2027-03-fruehlingsfasten.webp"          # optional, Bild liegt neben dieser Datei
bild_alt: "Gruppe beim Wandern im Frühling"       # Pflicht, wenn ein Bild angegeben ist
entwurf: false             # true: wird nicht angezeigt
---

Text der Kursleitung.
```

Stimmt ein Feld nicht, scheitert der Build. Der Termin geht dann nicht live, die bisherige Seite bleibt online.

## Bilder zu Terminen

- Das Bild liegt neben der Termin-Datei, gleicher Name, Endung `.webp` oder `.jpg`.
- **Vor dem Hochladen verkleinern:** längste Kante max. 2.400 px, max. 1,5 MB, ohne Metadaten. Sonst bricht der Bildwächter den Build ab und der Termin geht nicht live.
- Die Termin-Strecke (Option A) erledigt das selbst: bei Weg 1 der Skill, bei Weg 2 die App im Browser. Von Hand: `npm run bilder -- <Ordner> <Bereich>`.
- Auf der Seite liefert Astro automatisch passende Größen aus; das Teilen-Bild entsteht als JPG mit 1.200 px.

## Anzeige

- Die Terminliste zeigt die **nächsten 12 Monate**, nach Monat gegliedert, mit Kategorie als Etikett.
- Jeder Termin bekommt eine eigene Seite unter `/termine/<dateiname>/` mit Veranstaltungsdaten für Suchmaschinen (schema.org/Event) und steht, solange er nicht vorbei ist, in der Sitemap.
- **„Heute“ ist der Zeitpunkt des letzten Builds.** Vergangene Termine verschwinden erst beim nächsten Build. Offen: regelmäßiger Build (z. B. nachts) oder Ausblenden im Browser.
