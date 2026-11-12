# Anfrageformular und Spamschutz

Stand: 12.11.2026 · **Formular gebaut, Versand im Trockenlauf.** Die Vorschau zeigt an, welche Mail verschickt würde, verschickt aber nichts.

## Aufbau

- **Eine Seite statt Schritte**, Felder richten sich nach dem Anliegen (Gruppe, Firma, Kursleitung, Sonstiges). Das Anliegen ist je Seite vorausgewählt.
- Welche Felder sichtbar und Pflicht sind, steht an **einer** Stelle: `src/lib/anfrage.ts`. Browser und Worker nutzen dieselbe Liste.
- Haken **„Termin noch offen“** ersetzt die Datumsfelder durch ein Freitextfeld.
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

## Versand (offen)

- **Weg:** SMTP über ein Postfach des Hauses bei all-inkl. Keine DNS-Änderung, SPF und DKIM sind dort eingerichtet.
- **Cloudflare scheidet aus:** Email Routing auf einer Subdomain hängt an der Hauptdomain, und die lässt sich nur mit Cloudflare-MX einschalten (würde die Mail des Hauses umleiten). Email Sending braucht Workers Paid (5 $/Monat). Geprüft am 12.11., nichts geändert.
- **Postfach:** offen. Kontingent bei all-inkl ist erschöpft; Frage an Fabian und Vadim, wofür `noreply@` und `system@` genutzt werden (12.11.).
- **Zugangsdaten** als Secrets am Worker, **Empfänger** `MAIL_AN` als Variable bei Cloudflare, beides nie im Repo. Testanfragen gehen an Matthias.
- Einschalten: Variable `MAIL_MODUS` auf `senden`.

## Vor dem Go-live

- Secret `ALTCHA_SECRET` setzen. Ohne Secret leitet der Worker zu Testzwecken einen Schlüssel ab; dieser Rückfall muss raus.
- `/api/test/*`, `/api/anfrage/pruefen` und die Messseite `/test/` entfernen, ausführliche Fehlermeldungen im Worker kürzen.
- **Wiederverwendung:** Benutzte Aufgaben merkt sich nur das jeweilige Isolate. Die kurze Gültigkeit begrenzt den Schaden; strenger ginge es mit Workers KV (dann Speicherung, Datenschutzerklärung).
- `MAIL_AN` auf die Adresse des Hauses umstellen.
