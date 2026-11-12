# Go-live · Drehbuch

Stand: 12.11.2026 · Umstellung von selbst-gemacht.eu von der WordPress-Seite (all-inkl) auf den Worker `selbst-gemacht` (Cloudflare).

## Warum das wenig riskant ist

`selbst-gemacht.eu` und `www` laufen **schon heute über Cloudflare** (Einträge mit orangener Wolke, „Proxied“). Für Besucher ändert sich nur, wohin Cloudflare intern weiterreicht: statt zu all-inkl zum Worker. Es gibt **keine DNS-Laufzeit**, die Umstellung und der Rückweg wirken innerhalb von Sekunden bis wenigen Minuten *(Modellwissen: proxied Einträge zeigen nach außen immer auf Cloudflare-Adressen)*.

**Nicht angefasst werden:** MX, SPF (`v=spf1 …`), DKIM-, DMARC- und Mailchimp-Einträge, der Platzhalter `*.selbst-gemacht.eu` und alle Einträge für die Dienste des Hauses. Die Mail des Hauses ist von der Umstellung nicht betroffen.

## A · Vorher (Tage davor)

- [ ] Freigabe der Seite durch Katrin und Anne
- [ ] Impressum, Datenschutz, Bildnachweis freigegeben (`docs/rechtstexte.md`)
- [ ] Formular scharf: Postfach, Secrets, `MAIL_MODUS=senden`, `ALTCHA_SECRET`; echte Testanfrage kommt an
- [ ] Weiterleitungen geklärt (`docs/weiterleitungen.md`)
- [ ] Aufräumen im Repo: Messseite `src/pages/test/`, Beispieltermine `*beispiel*`, `platzhalter.webp`, Endpunkte `/api/test/*` und `/api/anfrage/pruefen`, ausführliche Fehlermeldungen im Worker
- [ ] Fabian informiert, für die Umstellung telefonisch erreichbar
- [ ] Zugang geprüft: Matthias kann im Cloudflare-Konto **DNS-Einträge bearbeiten**, **Custom Domains am Worker** anlegen und **Redirect Rules** anlegen (Rechte des Mitgliedskontos)

## B · Indexierung freigeben (Pull Request, vor der Umstellung mergen)

- [ ] `src/layouts/Basis.astro`: `NOINDEX = false`
- [ ] `public/_headers`: Zeile `X-Robots-Tag` entfernen
- [ ] `public/robots.txt`: ersetzen durch
  ```
  User-agent: *
  Allow: /
  Sitemap: https://selbst-gemacht.eu/sitemap.xml
  ```
- [ ] `astro.config.mjs`: `site: 'https://selbst-gemacht.eu'`

Bis Schritt C ist die neue Seite nur unter der Test-Adresse erreichbar. Die Freigabe der Indexierung wirkt erst mit der echten Adresse.

## C · Umstellung (ca. 15 Minuten)

**C1 · Stand notieren.** In `Cloudflare → selbst-gemacht.eu → DNS → Records` die beiden Einträge abschreiben (oder Screenshot):

| Name | Typ | Inhalt | Proxy |
|---|---|---|---|
| `selbst-gemacht.eu` | CNAME | `w0129234.kasserver.com` | Proxied |
| `www.selbst-gemacht.eu` | CNAME | `w0129234.kasserver.com` | Proxied |

(Stand 12.11.2026. Wenn es am Tag anders aussieht: anhalten und klären.)

**C2 · Hauptdomain umstellen.**
1. DNS: Eintrag `selbst-gemacht.eu` (CNAME) **löschen**. Cloudflare lässt keine Custom Domain auf einem Namen mit bestehendem CNAME zu.
2. Sofort danach: `Workers & Pages → selbst-gemacht → Settings → Domains & Routes → Add → Custom Domain` → `selbst-gemacht.eu`. Cloudflare legt den passenden DNS-Eintrag selbst an und stellt das Zertifikat aus.
3. Warten, bis der Status „Active“ zeigt (meist wenige Minuten).

Zwischen 1 und 2 zeigt die Hauptdomain kurz einen Fehler. Darum beide Schritte direkt nacheinander.

**C3 · www auf die Hauptdomain umleiten.**
1. DNS: Eintrag `www` bearbeiten: Inhalt von `w0129234.kasserver.com` auf `selbst-gemacht.eu` ändern, Proxy bleibt an.
2. `Rules → Redirect Rules → Create rule → Vorlage „Redirect from WWW to root“` (oder von Hand: Hostname gleich `www.selbst-gemacht.eu` → dynamisch `concat("https://selbst-gemacht.eu", http.request.uri.path)`, 301, Abfrage beibehalten).

**C4 · Protokoll.** Beide Änderungen mit Datum, vorher und nachher in `docs/betrieb.md` eintragen.

## D · Prüfen (direkt danach)

- [ ] `https://selbst-gemacht.eu` zeigt die neue Seite (Inkognito-Fenster, Handy im Mobilfunk)
- [ ] `https://www.selbst-gemacht.eu/firmen/` leitet auf `https://selbst-gemacht.eu/firmen/` um
- [ ] Alte Adressen leiten um, Stichproben: `/business/`, `/startseite/`, `/produkt/fastenkurs-mit-gisela/`, `/datenschutzerklaerung/`
- [ ] Unbekannte Adresse zeigt die 404-Seite
- [ ] Quelltext: kein `noindex`; `/robots.txt` mit Sitemap-Zeile; `/sitemap.xml` mit echten Adressen
- [ ] Anfrageformular: echte Anfrage, Mail kommt an, „Antworten“ geht an die Absenderadresse
- [ ] **Mail des Hauses:** eine Mail von außen an `info@` bzw. eine Mitarbeiter-Adresse schicken und eine Antwort zurück, beides kommt an

## E · Rückweg (wenn D nicht klappt)

1. `Workers & Pages → selbst-gemacht → Settings → Domains & Routes`: Custom Domain `selbst-gemacht.eu` **entfernen**.
2. DNS: prüfen, ob noch ein Eintrag für `selbst-gemacht.eu` da ist. Falls ja, löschen. Dann den CNAME aus C1 wieder anlegen: `selbst-gemacht.eu` → `w0129234.kasserver.com`, Proxied.
3. DNS: `www` wieder auf `w0129234.kasserver.com`.
4. Redirect Rule aus C3 deaktivieren.
5. Die alte WordPress-Seite ist sofort wieder da (sie läuft bei all-inkl unverändert weiter).

## F · Danach

- [ ] Search Console: Inhaber sind Katrin bzw. systeme@ (siehe Architektur D-10). Sitemap `https://selbst-gemacht.eu/sitemap.xml` einreichen.
- [ ] Nach 3–7 Tagen in der Search Console nach 404-Fehlern sehen, fehlende Weiterleitungen ergänzen.
- [ ] Die WordPress-Seite bei all-inkl **noch 4 Wochen** nicht löschen (Rückweg, Inhalte nachschlagen). Danach mit Fabian klären, was mit dem Webspace passiert.
- [ ] Das alte Zertifikat (Cloudflare legt beim Custom Domain ein „Advanced Certificate“ an) bleibt bei Entfernen bestehen und muss gegebenenfalls von Hand gelöscht werden: `SSL/TLS → Edge Certificates`.
