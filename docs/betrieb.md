# Betrieb

Stand: 11.11.2026

## Konten

| Dienst | Konto | Zweck |
|---|---|---|
| GitHub | `sysadmin-selbstgemacht` (systeme@selbst-gemacht.eu) | Repo `website` |
| Cloudflare | Konto „selbst-gemacht.eu“ | DNS-Zone, Pages-Projekt `selbst-gemacht` |
| all-inkl.com | über Fabian | Domain-Registrierung, Mail-Postfächer |

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
- [ ] Matthias' Zugänge entziehen (GitHub-Collaborator, Cloudflare-Mitglied)
- [ ] CODEOWNERS mit Pflegepartner scharf schalten
- [ ] Wiederherstellungscodes übergeben
