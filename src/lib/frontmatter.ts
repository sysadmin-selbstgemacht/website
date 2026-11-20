// Liest und schreibt den Kopf (Frontmatter) von Termin-Dateien.
// Bewusst klein: Werte werden als JSON geschrieben (gültiges YAML). Gelesen wird dieses Format
// plus einfache Hand-Einträge (Datum, Zahl, ja/nein, Text ohne Anführungszeichen, Kommentare).
// Mehrzeilige YAML-Werte versteht der Leser nicht; dann meldet er einen Fehler, statt zu raten.

export type Wert = string | number | boolean | string[] | null;

export class FrontmatterFehler extends Error {}

export function lesen(datei: string): { daten: Record<string, Wert>; text: string } {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(datei);
  if (!m) throw new FrontmatterFehler('Kein Dateikopf (---) gefunden');
  const daten: Record<string, Wert> = {};
  for (const zeile of m[1].split(/\r?\n/)) {
    if (!zeile.trim() || zeile.trimStart().startsWith('#')) continue;
    const z = /^([a-z_][a-z0-9_]*):\s*(.*)$/i.exec(zeile);
    if (!z) throw new FrontmatterFehler(`Zeile nicht lesbar: ${zeile.slice(0, 60)}`);
    daten[z[1]] = wert(z[2]);
  }
  return { daten, text: m[2].replace(/^\s*\n/, '').trimEnd() };
}

function wert(roh: string): Wert {
  let s = roh.trim();
  if (s === '' || s === '~' || s === 'null') return null;
  if (s.startsWith('"') || s.startsWith('[')) {
    // JSON, evtl. mit Kommentar dahinter
    for (let i = s.length; i > 0; i--) {
      try { return JSON.parse(s.slice(0, i)) as Wert; } catch { /* kürzer versuchen */ }
    }
    throw new FrontmatterFehler(`Wert nicht lesbar: ${s.slice(0, 60)}`);
  }
  if (s.startsWith("'")) {
    const e = s.indexOf("'", 1);
    if (e < 0) throw new FrontmatterFehler(`Wert nicht lesbar: ${s.slice(0, 60)}`);
    return s.slice(1, e).replace(/''/g, "'");
  }
  s = s.replace(/\s+#.*$/, '');
  if (s === 'true') return true;
  if (s === 'false') return false;
  if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s);
  return s;
}

// Reihenfolge der Schlüssel beim Schreiben; unbekannte Schlüssel folgen am Ende.
const REIHENFOLGE = [
  'titel', 'leitung', 'beginn', 'ende', 'uhrzeit_beginn', 'uhrzeit_ende', 'eigener_termin', 'anmeldung_web',
  'kurzbeschreibung', 'bild', 'bild_alt', 'bild_nachweis', 'uebernachtung', 'verpflegung', 'preis_ab',
  'kursgebuehr', 'ust',
];
const DATUMSFELDER = new Set(['beginn', 'ende']);

export function schreiben(daten: Record<string, Wert | undefined>, text: string): string {
  const schluessel = [...REIHENFOLGE.filter((k) => k in daten), ...Object.keys(daten).filter((k) => !REIHENFOLGE.includes(k))];
  const zeilen = ['---'];
  for (const k of schluessel) {
    const v = daten[k];
    if (v === undefined || v === null || v === '') continue;
    zeilen.push(`${k}: ${DATUMSFELDER.has(k) && typeof v === 'string' ? v : JSON.stringify(v)}`);
  }
  zeilen.push('---', '');
  return zeilen.join('\n') + (text.trim() ? text.trim() + '\n' : '');
}
