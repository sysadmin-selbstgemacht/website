# Anfrageformular und Spamschutz

Stand: 12.11.2026 · **Formular gebaut, Versand gebaut, eingestellt auf Trockenlauf.** Die Vorschau zeigt an, welche Mail verschickt würde, verschickt aber nichts. Zum Einschalten fehlen nur Postfach und Passwort.

## Aufbau

- **Eine Seite statt Schritte**, Felder richten sich nach dem Anliegen (Gruppe, Firma, Kursleitung, Sonstiges). Das Anliegen ist je Seite vorausgewählt.
- Welche Felder sichtbar und Pflicht sind, steht an **einer** Stelle: `src/lib/anfrage.ts`. Browser und Worker nutzen dieselbe Liste.
- Datumsfelder heißen überall **Anreise / Abreise**. Haken **„Termin noch offen“** ersetzt sie durch ein Freitextfeld.
- Kein Website-Feld bei Kursleitung (ergibt sich aus Mail oder Nachricht).
- Die Mail geht **an das Haus**. „Antwort an“ ist die Adresse der anfragenden Person, Anne kann also direkt antworten. **Keine Bestätigungsmail** an Anfragende: Spam würde sonst an fremde Adressen gehen.

## Spamschutz

Kein Captcha-Dienst, keine Cookies, keine Daten an Dritte. Prüfung im Worker (`worker/index.ts`) in dieser Reihenfolge:

| # | Stufe | bei Treffer |
|---|---|---|
| 1 | Verstecktes Feld `sg_feld7` (`display:none`) gefüllt | 200, nichts senden |
| 2 | Ausfüllzeit unter 2 s oder fehlend | 200, nichts senden |
| 3 | Rate Limit: mehr als 3 Anfragen je 60 s und IP (Cloudflare-Binding `ANFRAGE_LIMIT`, je Standort, ungefähr) | 429, sichtbar |
| 4 | Rechenaufgabe (ALTCHA, MIT, selbst betrieben) fehlt oder falsch | 403, sichtbar |
| 5 | Pflichtfelder, E-Mail, Datum, Personenzahl | 400, Feldfehler sichtbar |

**Regel:** Keine Stufe darf eine echte Anfrage still verwerfen. Stufen 1 und 2 vor dem Go-live mit echten Browsern und Autofüllung testen (Chrome, Safari, Firefox, Handy).

## Endpunkte

| Pfad | Zweck |
|---|---|
| `GET /api/anfrage/challenge` | Aufgabe ausstellen (PBKDF2/SHA-256, Kosten 2000, gültig 20 Minuten) |
| `POST /api/anfrage` | Anfrage prüfen und senden; derzeit Trockenlauf |
| `POST /api/anfrage/pruefen` | nur Lösung prüfen, für die Messseite `/test/altcha/` |
| `GET /api/test/smtp` | **vorübergehend:** erreicht der Worker den Mailserver von all-inkl? |
| `GET /api/test/smtp-anmeldung` | **vorübergehend:** nimmt all-inkl die hinterlegten Zugangsdaten an? Meldet sich nur an, verschickt nichts. Ohne Secrets mit absichtlich falschen Daten (erwartet: abgelehnt) |

## Messwerte

**11.11.2026, ALTCHA** · lokal (workerd) und auf der Vorschau:
- Läuft **ohne** `nodejs_compat` (`altcha-lib/algorithms/web/pbkdf2`, WebCrypto).
- Lösen in Desktop-Chrome 157: **1,9–2,5 s** (k-a-d-o.com: 1,8–2,4 s).
- Gültig 200 · nochmal 403 · verfälscht 403 · Kosten manipuliert 403 · ohne Lösung 403.
- „Server 0 ms“ ist kein Messwert: Workers halten die Uhr während einer Berechnung an.

**12.11.2026, Formular** · lokal (workerd):
- verstecktes Feld 200 · zu schnell 200 · ohne Zeitangabe 200 · ohne Rechenaufgabe 403
- fehlende Personenzahl und Abreise vor Anreise → 400 mit beiden Feldfehlern
- „Termin noch offen“ mit Freitext → 200 · Kursleitung mit Wunschzeitraum → 200
- Rate Limit: 4 Anfragen von derselben IP → 200 200 200 429

Offen: Vorschau mit echtem Browser, Handy, Safari, Firefox.

## Versand

- **Weg:** SMTP über ein Postfach des Hauses bei all-inkl (`worker/smtp.ts`, eigener schlanker Client ohne Fremdbibliothek). Port 465 mit TLS. Keine DNS-Änderung, SPF und DKIM sind dort eingerichtet.
- **Die Mail:** Absender „SELBSTGEMACHT Website“ mit der Postfach-Adresse, **Antworten** geht direkt an die anfragende Person (Reply-To). Betreff nennt Anliegen, Personen, Zeitraum und Name. Reiner Text, UTF-8, Umlaute geprüft.
- **Fehler:** Fehlen Zugangsdaten, antwortet das Formular mit „Versand nicht eingerichtet“ (503). Lehnt der Mailserver ab, „Versand fehlgeschlagen“ (502). Das Log hält nur Schritt und Serverantwort fest, nie den Inhalt der Anfrage.
- **Cloudflare scheidet aus:** Email Routing auf einer Subdomain hängt an der Hauptdomain, und die lässt sich nur mit Cloudflare-MX einschalten (würde die Mail des Hauses umleiten). Email Sending braucht Workers Paid (5 $/Monat). Geprüft am 12.11., nichts geändert.
- **Postfach:** offen. Kontingent bei all-inkl ist erschöpft; Frage an Fabian und Vadim, wofür `noreply@` und `system@` genutzt werden (12.11.).

**Getestet 12.11.2026** · lokal gegen einen Test-Mailserver: vollständiges Gespräch (Anmeldung, Absender, Empfänger, Nachricht), Kopfzeilen und Text korrekt dekodiert, auch Umlaute und eine Zeile, die mit Punkt beginnt.

### Einschalten (Matthias, im Cloudflare-Dashboard)

Worker `selbst-gemacht` → Settings → Variables and Secrets:

| Name | Art | Wert |
|---|---|---|
| `SMTP_BENUTZER` | **Secret** | Postfach-Kennung bei all-inkl (z. B. `m0…`) |
| `SMTP_PASSWORT` | **Secret** | Passwort des Postfachs |
| `MAIL_VON` | Variable | Adresse des Postfachs, z. B. `noreply@selbst-gemacht.eu` |
| `MAIL_AN` | Variable | Testphase: Adresse von Matthias. Go-live: Adresse des Hauses |
| `MAIL_MODUS` | im Repo | `senden` (sonst Trockenlauf), siehe unten |

`SMTP_HOST`, `SMTP_PORT` brauchen keinen Eintrag (Standard: Server von all-inkl, 465).

Reihenfolge: erst die beiden Secrets, dann `/api/test/smtp-anmeldung` aufrufen (muss „Anmeldung erfolgreich“ melden), dann `MAIL_AN` und `MAIL_VON`, zuletzt der Pull Request mit `MAIL_MODUS: "senden"`. Eine Testanfrage über das Formular schicken.

Wichtig: `MAIL_MODUS` steht in `wrangler.jsonc` und wird bei jedem Deploy von dort gesetzt. **Einschalten deshalb per Pull Request** (`"MAIL_MODUS": "senden"`), nicht im Dashboard. `MAIL_AN` und `MAIL_VON` stehen nur im Dashboard; `keep_vars` sorgt dafür, dass Deploys sie nicht löschen. Secrets bleiben ohnehin erhalten.

## Vor dem Go-live

- Secret `ALTCHA_SECRET` setzen. Ohne Secret leitet der Worker zu Testzwecken einen Schlüssel ab; dieser Rückfall muss raus.
- `/api/test/*`, `/api/anfrage/pruefen` und die Messseite `/test/` entfernen, ausführliche Fehlermeldungen im Worker kürzen.
- **Wiederverwendung:** Benutzte Aufgaben merkt sich nur das jeweilige Isolate. Die kurze Gültigkeit begrenzt den Schaden; strenger ginge es mit Workers KV (dann Speicherung, Datenschutzerklärung).
- `MAIL_AN` auf die Adresse des Hauses umstellen.
