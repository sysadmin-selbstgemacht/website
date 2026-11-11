# Go-live-Checkliste

Bis zum Go-live läuft die Seite nur unter `selbst-gemacht.fabian-liesch.workers.dev` und wird nicht indexiert.

## Vorher

- [ ] Freigabe durch Katrin und Anne
- [ ] Impressum, Datenschutz, Bildnachweis eingebaut und freigegeben
- [ ] Formularversand getestet (ohne MX-Einträge zu verändern)
- [ ] Fabian informiert, Termin für die Umstellung vereinbart
- [ ] Messseite `src/pages/test/` gelöscht
- [ ] Beispieltermine `src/content/termine/*beispiel*` gelöscht
- [ ] Bild `src/assets/bilder/platzhalter.webp` gelöscht
- [ ] Spamschutz: Secret `ALTCHA_SECRET` gesetzt, Test-Rückfall im Worker entfernt (docs/formular.md)

## Indexierung freigeben

- [ ] `src/layouts/Basis.astro`: `NOINDEX = false`
- [ ] `public/_headers`: Zeile `X-Robots-Tag` entfernen
- [ ] `public/robots.txt`: `Disallow: /` ersetzen durch `Allow: /` und Sitemap-Zeile
- [ ] `astro.config.mjs`: `site` auf `https://selbst-gemacht.eu`

## Umstellung

- [ ] DNS-Einträge Apex und `www` vorher notieren (docs/betrieb.md)
- [ ] Custom Domains im Worker `selbst-gemacht` hinzufügen (Domains & Routes)
- [ ] Weiterleitungen von alten WordPress-Adressen einrichten
- [ ] Mailversand und -empfang nach der Umstellung testen
- [ ] Search Console: neue Sitemap einreichen
