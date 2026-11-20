# Termin-Formular · Einrichtung und Betrieb

Stand: 20.11.2026. Für Katrin und Annekathrin: Termine anlegen, kopieren, bearbeiten, löschen und Kursleitungen pflegen, ohne GitHub zu sehen.

Adresse: `/intern/termin/` (nicht in der Sitemap, noindex).

## Ablauf

1. Formular ausfüllen → **Speichern und Vorschau**.
2. Der Worker legt einen Branch an (`termin/<kennung>` bzw. `kursleitung/<kennung>`), schreibt **einen** Commit und öffnet einen Pull Request. Das ist der **Entwurf**.
3. Workers Builds baut die Vorschau. Das Formular zeigt den Stand und, sobald die Prüfung grün ist, den Link zur Vorschau.
4. **Veröffentlichen**: Der Worker merged den Pull Request (Squash). Das Ruleset verlangt weiter die grüne Prüfung „Workers Builds“; rot geht nichts live.
5. **Verwerfen**: Pull Request schließen, Branch löschen, nur im Entwurf hochgeladene Bilder löschen.

Weitere Änderungen an einem offenen Entwurf landen im selben Pull Request. Löschen ist auch ein Entwurf und wird erst mit „Veröffentlichen“ wirksam; dann wird auch das Bild in R2 gelöscht.

**Bilder in R2** werden nur gelöscht, wenn sie über das Formular veröffentlicht oder verworfen werden. Wer einen Pull Request des Formulars in GitHub von Hand merged oder schließt, lässt verwaiste Bilder in R2 zurück. Sie sind harmlos (nicht verlinkt), kosten aber Platz.

## Einrichtung (Matthias, einmalig)

Alle Angaben zu Cloudflare und GitHub sind Modellwissen, bitte beim Einrichten prüfen.

### 1 · R2-Bucket — vor dem Merge dieses Pull Requests

`Cloudflare → R2 → Create bucket` → Name **`selbst-gemacht-medien`**, Standort automatisch. Kein öffentlicher Zugriff (der Worker liefert aus).
Ohne Bucket scheitert jeder Deploy, weil `wrangler.jsonc` das Binding `MEDIEN` verlangt.

### 2 · GitHub-Token

`GitHub → Settings → Developer settings → Fine-grained tokens → Generate`:
- Repository access: **nur** `sysadmin-selbstgemacht/website`
- Permissions: **Contents: Read and write**, **Pull requests: Read and write** (Metadata: Read kommt automatisch)
- Ablauf: so lang wie möglich; Ablaufdatum in `docs/betrieb.md` notieren

Der Besitzer des Tokens erscheint als Autor der Pull Requests (offene Frage 2.2: eigenes Maschinenkonto).
Eintragen als **Secret** am Worker: `Workers & Pages → selbst-gemacht → Settings → Variables and Secrets → Add → Secret` → `GITHUB_TOKEN`.

### 3 · Cloudflare Access

`Zero Trust → Access → Applications → Add → Self-hosted`:
- Pfade: `/intern/*` **und** `/api/intern/*` auf der Adresse, unter der das Formular laufen soll (offene Frage 1.19)
- Policy: Allow, Include → Emails: `info@selbst-gemacht.eu` und Matthias' Adresse für Tests
- Anmeldung: One-time PIN (Mailcode)

Danach am Worker als **Variablen** eintragen:
- `ACCESS_TEAM`: Teamname (der Teil vor `.cloudflareaccess.com`)
- `ACCESS_AUD`: „Application Audience (AUD) Tag“ der Anwendung
- `INTERN_ERLAUBT`: dieselben Mailadressen wie in der Policy, mit Komma getrennt

Der Worker prüft das Access-Token selbst (Signatur, Zielgruppe, Ablauf, Mailadresse). Fehlt eine dieser Variablen, bleibt das Formular gesperrt („Zugang nicht eingerichtet“), auch wenn Access falsch eingestellt ist.

### 4 · Probe

1. `/intern/termin/` öffnen → Mailcode → Übersicht erscheint.
2. Testtermin anlegen (Titel mit „Test“), Vorschau prüfen, **verwerfen**.
3. In R2 prüfen, dass das Testbild wieder weg ist.

## Lokal

`INTERN_LOKAL=ja` in `.dev.vars` schaltet die Anmeldung **nur auf localhost** ab (`wrangler dev`). Ohne `GITHUB_TOKEN` antwortet die API mit 503.

## Grenzen (bekannt)

- Die Übersicht liest den veröffentlichten Stand aus dem letzten Build (`/intern/daten.json`). Gerade veröffentlichte Änderungen erscheinen nach etwa zwei Minuten.
- Eine im Entwurf neu angelegte Kursleitung steht für **andere** Termine erst nach dem Veröffentlichen zur Auswahl.
- Mehrzeilige YAML-Werte in einer von Hand bearbeiteten Termin-Datei versteht das Formular nicht; es meldet dann „Datei nicht lesbar“.
- Workers Free erlaubt 50 Anfragen an andere Dienste je Aufruf (Modellwissen). Ein Speichern braucht etwa 10–15.
