// Gemeinsame Definition des Anfrageformulars: wird im Browser (Anzeige) und im Worker (Prüfung) genutzt.
// Felder, Pflicht und Regeln hier ändern, nicht an zwei Stellen. Stand der Entscheidungen: 19./20.11.2026.

// 'termin': Anfrage zu einem eigenen Termin des Hauses, nur auf der Terminseite (nicht in der Auswahl).
export type Anliegen = 'gruppe' | 'firma' | 'kursleitung' | 'sonstiges' | 'termin';

export const ANLIEGEN: { wert: Anliegen; text: string }[] = [
  { wert: 'gruppe', text: 'Gruppen' },
  { wert: 'firma', text: 'Tagungen' },
  { wert: 'kursleitung', text: 'Kursleitung: Kurs oder Retreat' }, // Bezeichnung offen (Formularfrage 1)
  { wert: 'sonstiges', text: 'Sonstiges' },
];
export const ALLE_ANLIEGEN: Anliegen[] = [...ANLIEGEN.map((a) => a.wert), 'termin'];
export const ANREDE = ['Frau', 'Herr', 'Divers'];

export type Feld =
  | 'von' | 'bis' | 'offen' | 'zeitraum' | 'personen' | 'erwachsene' | 'kinder' | 'unternehmen' | 'uebernachtung'
  | 'thema' | 'email' | 'telefon' | 'nachricht'
  | 'termin' | 'anrede' | 'vorname' | 'nachname';

const PERSON: Feld[] = ['anrede', 'vorname', 'nachname', 'email', 'telefon'];

// Welche Felder je Anliegen vorkommen und welche Pflicht sind.
// Bedingungen (Flexibel im Termin, Übernachtung) regeln sichtbareFelder() und pflichtfelder() unten.
export const FELDER: Record<Anliegen, { sichtbar: Feld[]; pflicht: Feld[] }> = {
  gruppe: {
    sichtbar: ['von', 'bis', 'offen', 'zeitraum', 'erwachsene', 'kinder', ...PERSON, 'nachricht'],
    pflicht: ['von', 'bis', 'zeitraum', 'erwachsene', ...PERSON],
  },
  firma: {
    sichtbar: ['unternehmen', 'von', 'bis', 'offen', 'zeitraum', 'personen', 'uebernachtung', ...PERSON, 'nachricht'],
    pflicht: ['unternehmen', 'von', 'bis', 'zeitraum', 'personen', 'uebernachtung', ...PERSON],
  },
  kursleitung: {
    sichtbar: ['thema', 'zeitraum', ...PERSON, 'nachricht'],
    pflicht: ['thema', 'zeitraum', ...PERSON],
  },
  sonstiges: {
    sichtbar: [...PERSON, 'nachricht'],
    pflicht: [...PERSON, 'nachricht'], // Telefon überall Pflicht (20.11.)
  },
  // Terminseite (Wireframe „Terminseite“, eigener Termin): alles Pflicht außer Nachricht
  termin: {
    sichtbar: ['termin', ...PERSON, 'nachricht'],
    pflicht: ['termin', ...PERSON],
  },
};

// Gruppen wählen Anreise und Abreise im Verfügbarkeitskalender (3RPMS), nicht in Datumsfeldern.
export const MIT_KALENDER: Anliegen[] = ['gruppe'];
// Mindestens so viele Nächte zwischen Anreise und Abreise (Gruppen: eine Nacht, Tagungen: auch Tagesveranstaltung).
export const MIN_NAECHTE: Partial<Record<Anliegen, number>> = { gruppe: 1, firma: 0 };
// Kalender: so weit im Voraus wählbar
export const KALENDER_MONATE = 18;

export const BESCHRIFTUNG: Partial<Record<Anliegen, Partial<Record<Feld, string>>>> = {
  firma: { personen: 'Teilnehmende' },
  kursleitung: { zeitraum: 'Wunschzeitraum' },
  sonstiges: { nachricht: 'Ihre Nachricht' },
};

// Standardbeschriftungen, wo BESCHRIFTUNG nichts anderes sagt.
export const STANDARD: Partial<Record<Feld, string>> = {
  von: 'Anreise', bis: 'Abreise', offen: 'Flexibel im Termin', zeitraum: 'Zeitraum', personen: 'Personen',
  erwachsene: 'Erwachsene', kinder: 'Kinder (4–12 Jahre)', unternehmen: 'Unternehmen', uebernachtung: 'Übernachtung',
  thema: 'Kurs oder Thema', email: 'E-Mail', telefon: 'Telefon', nachricht: 'Nachricht (freiwillig)',
  termin: 'Termin', anrede: 'Anrede', vorname: 'Vorname', nachname: 'Nachname',
};

export const UEBERNACHTUNG = ['ja', 'nein', 'teilweise'];

export const BESTAETIGUNG = 'Besten Dank, wir haben Ihre Anfrage erhalten. Wir melden uns innerhalb eines Werktages bei Ihnen.';

export interface Zustand { offen: boolean; von?: string; bis?: string }

/** Nächte zwischen zwei ISO-Daten (JJJJ-MM-TT); null, wenn eines fehlt. */
export function naechte(von?: string, bis?: string): number | null {
  if (!von || !bis) return null;
  const t = (d: string) => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10));
  return Math.round((t(bis) - t(von)) / 86400000);
}

/** Sichtbare Felder je nach „Flexibel im Termin“ und Datum. */
export function sichtbareFelder(anliegen: Anliegen, z: Zustand): Set<Feld> {
  const s = new Set(FELDER[anliegen].sichtbar);
  if (s.has('offen')) {
    if (z.offen) { s.delete('von'); s.delete('bis'); } else s.delete('zeitraum');
  }
  // Übernachtung nur bei mindestens einer Nacht oder bei „Flexibel im Termin“
  if (s.has('uebernachtung') && !z.offen && !((naechte(z.von, z.bis) ?? 0) >= 1)) s.delete('uebernachtung');
  return s;
}

/** Pflichtfelder unter den gerade sichtbaren. */
export function pflichtfelder(anliegen: Anliegen, z: Zustand): Feld[] {
  const s = sichtbareFelder(anliegen, z);
  return FELDER[anliegen].pflicht.filter((f) => s.has(f));
}

export const GRENZEN = { kurz: 200, nachricht: 5000, personenMax: 200 };
