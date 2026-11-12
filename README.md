# selbst-gemacht.eu · Website

Website von **SELBSTGEMACHT – Seminar- und Gästehaus**, Arnsgrün (Zeulenroda-Triebes).

Statische Seite mit [Astro](https://astro.build), ausgeliefert als Cloudflare Worker mit statischen Assets (`wrangler.jsonc`). Kein Server, keine Datenbank, keine Sicherheitsupdates für die ausgelieferte Seite.

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

## Bilder und Videos

- **Ins Repo kommen nur web-taugliche Fassungen:** WebP, längste Kante höchstens 2.400 px, Ablage in `src/assets/bilder/`. Originale bleiben im OneDrive des Hauses. Grund: Das Repo ist öffentlich, Originale in voller Auflösung wären frei herunterladbar.
- **Nur Bilder mit geklärten Nutzungsrechten**, keine Bilder mit eingebranntem ©-Vermerk. Fotografen stehen im Bildnachweis (Impressum).
- Bilder immer über `src/components/Bild.astro` einbinden. Astro erzeugt daraus beim Build mehrere Breiten (480 bis 2.400 px, AVIF und WebP), der Browser lädt je Bildschirm die kleinste passende.
- **Bildwächter:** Vor jedem Build prüft `scripts/bilder-pruefen.mjs` alle Bilder (max. 2.400 px, max. 1,5 MB, keine Metadaten, nur WebP/JPG/PNG/AVIF). Ein Verstoß lässt den Build scheitern, der Pull Request lässt sich dann nicht mergen.
- **Videos liegen nicht im Repo**, sondern im Cloudflare-Dateispeicher R2 (Bucket `selbst-gemacht-medien`). Workers liefern Einzeldateien nur bis 25 MiB aus.
- **Inhalte von Dritten** (Karte, fremdes Video, Widgets) nur über `src/components/Drittinhalt.astro`. Sie laden erst nach Klick.

## Seitentitel und Beschreibungen

- Feste Seiten: **eine** Datei, `src/lib/seiten.ts` (Titel, Beschreibung, Teilen-Bild). Die Sitemap liest dieselbe Liste. Neue Seite: dort eintragen.
- Termine: Titel aus der Termin-Datei, Beschreibung aus dem Feld `beschreibung` oder automatisch aus Titel, Datum und Leitung. Kommende Termine stehen automatisch in der Sitemap.

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
- `docs/termine.md` – Aufbau eines Termin-Eintrags
- `docs/formular.md` – Anfrageformular und Spamschutz
- `docs/go-live.md` – Drehbuch für die Umstellung
- `docs/weiterleitungen.md` – alte Adressen der WordPress-Seite
- `docs/rechtstexte.md` – Stand Impressum und Datenschutz
