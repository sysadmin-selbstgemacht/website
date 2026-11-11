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
entwurf: false             # true: wird nicht angezeigt
---

Text der Kursleitung.
```

Stimmt ein Feld nicht, scheitert der Build. Der Termin geht dann nicht live, die bisherige Seite bleibt online.

## Anzeige

- Die Terminliste zeigt die **nächsten 12 Monate**, nach Monat gegliedert, mit Kategorie als Etikett.
- Jeder Termin bekommt eine eigene Seite unter `/termine/<dateiname>/` mit Veranstaltungsdaten für Suchmaschinen (schema.org/Event).
- **„Heute“ ist der Zeitpunkt des letzten Builds.** Vergangene Termine verschwinden erst beim nächsten Build. Offen: regelmäßiger Build (z. B. nachts) oder Ausblenden im Browser.
