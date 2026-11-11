# Betrieb

Stand: 11.11.2026

## Konten

| Dienst | Konto | Zweck |
|---|---|---|
| GitHub | `sysadmin-selbstgemacht` (systeme@selbst-gemacht.eu) | Repo `website` |
| Cloudflare | Konto von Fabian (enthält Zone selbst-gemacht.eu); Matthias als Mitglied | DNS-Zone, Worker `selbst-gemacht` |
| all-inkl.com | über Fabian | Domain-Registrierung, Mail-Postfächer |

## Apps mit Zugriff auf das Repo

Beide nur für das Repo `website` installiert, unter GitHub → Settings → Applications widerrufbar.

| App | Zweck |
|---|---|
| Cloudflare Workers and Pages | baut bei jedem Push, Vorschau je Branch |
| Claude | Änderungen per Pull Request (Bau, später ggf. Termine) |

## Adressen

- Test (bis zum Go-live): https://selbst-gemacht.fabian-liesch.workers.dev
- Vorschau je Branch/Pull Request: Link erscheint im Pull Request

Wiederherstellungscodes und Zwei-Faktor-Zugang des GitHub-Kontos liegen bei: **[offen, bei Übergabe eintragen]**

## Zuständigkeiten

- **Inhalte und Termine:** Katrin und Anne
- **Technik, Struktur, SEO:** Pflegepartner **[offen]**
- **DNS-Zone und all-inkl:** Fabian. Vor jeder Unklarheit anrufen.

## Regeln für die DNS-Zone

Die Zone enthält Einträge für Dienste des Hauses (NAS, Home Assistant u. a.) und für Mail.

- Geändert werden **nur** `selbst-gemacht.eu` (Apex), `www` und neue Einträge für den Formularversand.
- **MX-, SPF-, DKIM- und DMARC-Einträge nicht anfassen.**
- Jede Änderung wird unten protokolliert: Datum, Eintrag vorher, Eintrag nachher, wer.

### Änderungsprotokoll DNS

| Datum | Eintrag | vorher | nachher | wer |
|---|---|---|---|---|
| – | – | – | – | – |

## Übergabe-Checkliste

- [ ] Weiterleitung von systeme@ an Matthias abschalten
- [ ] Matthias' Zugänge entziehen (GitHub-Collaborator `medzeen-dev`, Cloudflare-Mitglied)
- [ ] Claude-App prüfen: behalten (Option A, Weg 1) oder entfernen
- [ ] CODEOWNERS mit Pflegepartner scharf schalten
- [ ] Wiederherstellungscodes übergeben
