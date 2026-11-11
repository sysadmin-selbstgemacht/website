# Anfrageformular und Spamschutz

Stand: 11.11.2026 · **Messstufe.** Das Formular in der Fußzeile ist sichtbar, sendet aber noch nicht.

## Prinzip

Kein Captcha-Dienst, keine Cookies, keine Daten an Dritte. Mehrere einfache Stufen, die auf dem Worker (`worker/index.ts`) geprüft werden:

1. Verstecktes Feld (`sg_hp`, per `display:none` ausgeblendet). Gefüllt → still verwerfen.
2. Zeitprüfung: Ausfüllzeit unter 2 Sekunden oder fehlend → still verwerfen.
3. Rate Limit je IP.
4. Rechenaufgabe (ALTCHA, MIT-Lizenz, selbst betrieben): Der Browser löst im Hintergrund eine vom Server unterschriebene Aufgabe. Scheitert sie, sieht die Person eine Fehlermeldung.

**Regel:** Keine Stufe darf eine echte Anfrage still verwerfen. Jede stille Stufe mit echten Browsern und Autofüllung testen.

Umgesetzt sind bisher nur die Endpunkte für Stufe 4. Stufen 1–3 und der Versand folgen mit dem echten Formular.

## Endpunkte (Messstufe)

| Pfad | Zweck |
|---|---|
| `GET /api/anfrage/challenge` | stellt eine Aufgabe aus (PBKDF2/SHA-256, Kosten 2000, gültig 20 Minuten) |
| `POST /api/anfrage/pruefen` | prüft eine Lösung, **versendet nichts** |
| `/test/altcha/` | Messseite im Browser, wird vor dem Go-live gelöscht |

## Messwerte 11.11.2026

Lokal in der Workers-Laufzeit (`wrangler dev`):
- Läuft **ohne** `nodejs_compat` (`altcha-lib/algorithms/web/pbkdf2`, WebCrypto).
- Gültige Lösung → 200 · dieselbe Lösung nochmal → 403 · verfälschter Schlüssel → 403 · Kosten manipuliert → 403 · ohne Lösung → 403.
- Lösen in Node: ca. 3,9 s (Sandbox, langsam).

Auf der Vorschau im Browser: siehe Pull Request zu dieser Datei.

## Vor dem echten Formular

- **Secret setzen:** `ALTCHA_SECRET` als Secret am Worker (Cloudflare → Worker → Settings → Variables and Secrets). Ohne Secret leitet der Worker zu Testzwecken aus der Versions-ID ab (in Vorschauen aus einem festen Testwert). Dieser Rückfall und die ausführliche Fehlermeldung im Worker müssen vor dem Go-live raus.
- **Wiederverwendung:** Die Liste benutzter Aufgaben liegt nur im Speicher eines Isolates. Workers verteilen Anfragen auf viele Isolates, eine Wiederholung wird deshalb nur zufällig erkannt. Die kurze Gültigkeit (20 Minuten) begrenzt den Schaden. Strenger ginge es mit Workers KV, das ist dann Speicherung (Datenschutzerklärung).
- **Rate Limit:** Rate-Limiting-Binding von Workers oder WAF-Regel prüfen (Verfügbarkeit im Free-Tarif offen).
- **Versand:** Cloudflare Email Service an eine bestätigte Adresse. Braucht Email Routing auf einer Absender-Subdomain (z. B. `formular.selbst-gemacht.eu`). Vorher und nachher jeden DNS-Eintrag in `docs/betrieb.md` festhalten; bei Problemen zurückrollen.
- **Keine Bestätigungsmail** an Anfragende. Spam würde sonst an fremde Adressen gehen.
