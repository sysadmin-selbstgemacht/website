# Weiterleitungen der alten Seite

Stand: 12.11.2026 · Quelle: Sitemap der WordPress-Seite (57 Adressen). Regeln in `public/_redirects`.

Wer über Google, Lesezeichen oder alte Links kommt, landet mit einer dauerhaften Weiterleitung (301) auf der passenden neuen Seite statt auf „Seite nicht gefunden“. Google überträgt damit den größten Teil der bisherigen Platzierung auf die neue Adresse.

## Zu klären mit Katrin und Anne

| Alte Adresse | Jetzt → | Frage |
|---|---|---|
| `/business/` („Unternehmer & Kursleiter“) | `/firmen/` | Kamen hier eher Firmen oder Kursleitende an? |
| `/faq/`, `/business-faq/` | Gruppen- bzw. Firmenseite | Gibt es auf der neuen Seite häufige Fragen? Dann dorthin. |
| `/galerie/` | Start | Gibt es eine Bildergalerie? |
| `/kunst/`, `/architektur/` | Über uns | Passt das (Alfred als Architekt, Kunst im Haus)? |
| `/agb/`, `/agb-business/`, `/widerruf/` u. a. | Impressum | **Braucht die neue Seite AGB** (z. B. für Gruppenbuchungen, Stornobedingungen)? Dann eigene Seite, und die Weiterleitungen zeigen dorthin. |
| Blogartikel (`/waldbaden/`, `/gastgeber/`, `/ostern/` …) | thematisch nächste Seite oder Start | Sollen einzelne Artikel als Text erhalten bleiben (z. B. Waldbaden)? |
| `/produkt/…` (Kurse aus dem Shop) | Termine | passt, solange es eine Terminliste gibt |

## Nicht weitergeleitet

- Bilder und Videos unter `/wp-content/uploads/…`: Diese Adressen zeigen nach dem Umzug „nicht gefunden“. Auswirkung gering, außer Bilder sind auf fremden Seiten eingebunden.
- `/wp-admin/`, `/wp-login.php`: ohne Ziel, damit Angreifer nichts finden.
- `/locations.kml`: Kartendatei, entfällt.

## Nach dem Go-live

- In der Search Console unter „Seiten“ nach Adressen mit 404 sehen und fehlende Regeln ergänzen.
