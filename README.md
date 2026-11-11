# selbst-gemacht.eu · Website

Website von **SELBSTGEMACHT – Seminar- und Gästehaus**, Arnsgrün (Zeulenroda-Triebes).

Statische Seite mit [Astro](https://astro.build), gehostet auf Cloudflare Pages. Kein Server, keine Datenbank, keine Sicherheitsupdates für die ausgelieferte Seite.

## ⚠️ Drei Regeln, die nicht verhandelbar sind

1. **Keine Geheimnisse in diesem Repo.** Das Repo ist öffentlich. Passwörter, API-Schlüssel, Empfängeradressen der Formulare und Ähnliches liegen ausschließlich als Umgebungsvariablen bei Cloudflare.
2. **Das Repo bleibt öffentlich.** Der Schutz von `main` (Ruleset, CODEOWNERS) funktioniert bei GitHub Free nur in öffentlichen Repos. Wird das Repo auf privat gestellt, fällt der Schutz **ohne Warnung** weg. Wer privat will, braucht vorher GitHub Pro.
3. **Änderungen nur über Pull Request.** Direkt auf `main` schreiben ist gesperrt. Jeder Pull Request bekommt von Cloudflare eine Vorschau-Adresse.

## Wie es zusammenhängt

```
Änderung (Branch) → Pull Request → Cloudflare baut Vorschau → Merge in main → Cloudflare baut Live-Seite
```

- Inhalte liegen als Dateien im Repo. Termine: `src/content/termine/*.md`
- Ein fehlerhafter Termin (falsches Feld, Ende vor Beginn) lässt den Build scheitern und geht nicht live. Das Schema steht in `src/content.config.ts`.

## Lokal bauen

Node.js 22 (siehe `.nvmrc`).

```bash
npm ci
npm run dev     # lokale Vorschau
npm run build   # erzeugt dist/
```

## Konten

Alle Konten gehören SELBSTGEMACHT und laufen über `systeme@selbst-gemacht.eu`.
Details, Zuständigkeiten und Übergabe: `docs/betrieb.md`.

## Weitere Doku

- `docs/betrieb.md` – Konten, Zuständigkeiten, Regeln für DNS
- `docs/go-live.md` – Checkliste für die Umstellung auf selbst-gemacht.eu
- `docs/termine.md` – Aufbau eines Termin-Eintrags
