// Feste Werte und Grenzen für Termine und Kursleitungen.
// EINE Stelle: Schema (content.config.ts), Seiten, Worker (/api/intern/*) und das Termin-Formular
// lesen von hier. Wer hier etwas ändert, ändert es überall.

export const GRENZEN_TERMIN = {
  titelMin: 3,
  titelMax: 120,
  kurzbeschreibungMax: 160,
  beschreibungMax: 6000,
  bildAltMax: 200,
  nachweisMax: 120,
  leitungMax: 3,
  preisMax: 10000,
} as const;

export const GRENZEN_LEITUNG = {
  nameMin: 2,
  nameMax: 80,
  vorstellungMax: 400,
} as const;

// Verpflegung: feste Auswahl (Architekturentscheidungen Abschnitt 6, Briefing 20.11. Abschnitt 3).
export const VERPFLEGUNG = {
  vegetarisch: 'Vegetarisch',
  vegan: 'Vegan',
  fasten: 'Fastenbegleitende Verpflegung',
  'nach-absprache': 'Nach Absprache mit der Kursleitung',
  keine: 'Keine Verpflegung',
} as const;
export type Verpflegung = keyof typeof VERPFLEGUNG;
export const VERPFLEGUNG_WERTE = Object.keys(VERPFLEGUNG) as [Verpflegung, ...Verpflegung[]];
// Fester Zusatz (geklärt 20.11.): vegan ist ohnehin laktosefrei, daher dort nur glutenfrei
export function verpflegungZusatz(v: Verpflegung): string {
  return v === 'vegan' ? 'Glutenfrei auf Wunsch.' : 'Glutenfrei und laktosefrei auf Wunsch.';
}
// Übernachtung und Verpflegung: fester Steuerhinweis (Entscheidung 20.11.)
export const PREIS_AB_UST = 'inkl. 7 % USt';

// Umsatzsteuer auf die Kursgebühr (offene Fragen 1.13)
export const UST_WERTE = [0, 7, 19] as const;
export type Ust = (typeof UST_WERTE)[number];
export function ustText(u: Ust): string {
  return u === 0 ? 'umsatzsteuerfrei' : `inkl. ${u} % USt`;
}

// Bilder zu Terminen und Kursleitungen liegen NICHT im Repo, sondern in Cloudflare R2
// (Binding MEDIEN). Der Worker legt sie beim Speichern ab und liefert sie unter /medien/<schlüssel>/<größe> aus.
// Grund: echtes Löschen, nichts in der öffentlichen Git-Historie (Entscheidung 20.11.).
// Wert im Termin: "medien/termine/<kennung>" bzw. "medien/kursleitungen/<kennung>",
// oder ein Hausbild: "haus/<name>" (liegt im Repo, Rechte beim Haus).
// klein dient auch als Teilen-Bild (WhatsApp & Co. zeigen WebP, getestet 20.11.)
export const MEDIEN_GROESSEN = { gross: 2400, klein: 800 } as const;
export type MedienGroesse = keyof typeof MEDIEN_GROESSEN;
export const MEDIEN_MAX_BYTES = { gross: 1_500_000, klein: 300_000 } as const;
export const BILDWERT = /^(medien\/(termine|kursleitungen)\/[a-z0-9-]{3,90}|haus\/[a-z0-9-]{2,40})$/;

// Hausbilder als Notlösung, wenn kein Kursbild vorliegt (offene Fragen 1.7).
// Datei in src/assets/bilder/, 16:9. Echte Hausbilder hier ergänzen.
export const HAUSBILDER = [
  { name: 'platzhalter', datei: 'platzhalter.webp', titel: 'Platzhalter (vor Go-live durch echte Hausbilder ersetzen)', alt: 'Seminar- und Gästehaus SELBSTGEMACHT' },
] as const;
export const HAUSBILD_NAMEN = HAUSBILDER.map((h) => h.name) as string[];

export const UHRZEIT = /^([01]\d|2[0-3]):[0-5]\d$/;
export const DATUM_ISO = /^\d{4}-\d{2}-\d{2}$/;

// Nächte aus den Daten (Kalendertage, unabhängig von Zeitzone)
export function naechte(beginn: string | Date, ende: string | Date): number {
  const iso = (d: string | Date) => (typeof d === 'string' ? d : d.toISOString().slice(0, 10));
  const t = (s: string) => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10));
  return Math.round((t(iso(ende)) - t(iso(beginn))) / 86_400_000);
}

export function euro(betrag: number): string {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', minimumFractionDigits: Number.isInteger(betrag) ? 0 : 2 }).format(betrag);
}

// Kurzname für Dateien: "Fastenwoche im Frühling" -> "fastenwoche-im-fruehling"
export function kurzname(text: string, max = 40): string {
  const s = text
    .toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return s.slice(0, max).replace(/-+$/, '') || 'termin';
}

// Ausführliche Beschreibung: erlaubt sind nur Absätze, Aufzählungen (- ) und **fett** (offene Fragen 1.6).
// Alles andere, was Markdown sonst deuten würde, wird maskiert. Das Ergebnis ist Markdown.
// Zwischenformat zwischen Termin-Formular (Editor) und Termin-Datei, Zeile für Zeile:
//   Leerzeile        = neuer Absatz
//   „- “ (auch •, –, *) = Aufzählung mit Punkten
//   „1. “ (auch „1) “)  = nummerierte Aufzählung (wird fortlaufend neu nummeriert)
//   „\“ am Zeilenanfang = Absatz, auch wenn die Zeile wie ein Listenpunkt aussieht (z. B. „2026. war …“)
//   **Wort**          = fett
// Alles andere wird maskiert und erscheint wörtlich (#, [, <, _, * …). Entscheidung 1.6, erweitert 21.11.
const PUNKT = /^\s*[-*•–]\s+(.*)$/;
const NUMMER = /^\s*\d+[.)]\s+(.*)$/;

export function beschreibungMarkdown(eingabe: string): string {
  const zeilen = eingabe.replace(/\r\n?/g, '\n').split('\n').map((z) => z.replace(/\s+$/, ''));
  const aus: string[] = [];
  let vorher: 'leer' | 'text' | 'ul' | 'ol' = 'leer';
  let nr = 0;
  for (const roh of zeilen) {
    if (!roh.trim()) {
      if (vorher !== 'leer') aus.push('');
      vorher = 'leer';
      continue;
    }
    const woertlich = /^\s*\\/.test(roh);
    const p = woertlich ? null : PUNKT.exec(roh);
    const n = woertlich || p ? null : NUMMER.exec(roh);
    const art = p ? 'ul' : n ? 'ol' : 'text';
    // Wechsel zwischen Absatz und Aufzählungen braucht in Markdown eine Leerzeile
    if (vorher !== 'leer' && vorher !== art) aus.push('');
    if (art === 'ol' && vorher !== 'ol') nr = 0;
    const inhalt = p ? p[1] : n ? n[1] : woertlich ? roh.replace(/^\s*\\/, '').trim() : roh.trim();
    // **fett** schützen, Rest maskieren
    const teile = inhalt.split(/(\*\*[^*\n]+?\*\*)/g).map((t, i) =>
      i % 2 === 1 ? '**' + maske(t.slice(2, -2).trim(), false) + '**' : maske(t, i === 0),
    );
    aus.push((art === 'ul' ? '- ' : art === 'ol' ? `${++nr}. ` : '') + teile.join(''));
    vorher = art;
  }
  return aus.join('\n').trim();
}
// zeilenanfang: Zeichen, die am Anfang einer Zeile Markdown-Struktur bilden würden (1., -, +, =)
function maske(t: string, zeilenanfang: boolean): string {
  const m = t.replace(/([\\`*_\[\]<>#|~!])/g, '\\$1');
  return zeilenanfang ? m.replace(/^(\d+)([.)])/, '$1\\$2').replace(/^([+=-])/, '\\$1') : m;
}

// Markdown der Beschreibung zurück ins Zwischenformat (Umkehrung von beschreibungMarkdown).
// Absätze, die nach dem Entmaskieren wie ein Listenpunkt aussehen, bekommen das „\“ zurück.
export function beschreibungText(md: string): string {
  return md.replace(/\r\n?/g, '\n').split('\n').map((zeile) => {
    const liste = /^(- |\d+\. )/.exec(zeile);
    const rest = (liste ? zeile.slice(liste[0].length) : zeile).replace(/\\([\\`*_\[\]<>#|~!.)+=-])/g, '$1');
    if (liste) return liste[0] + rest;
    return rest.trim() && (PUNKT.test(rest) || NUMMER.test(rest)) ? '\\' + rest : rest;
  }).join('\n').trim();
}
