// Gemeinsame Definition des Anfrageformulars: wird im Browser (Anzeige) und im Worker (Prüfung) genutzt.
// Pflichtfelder hier ändern, nicht an zwei Stellen.

// 'termin': Anfrage zu einem eigenen Termin des Hauses, nur auf der Terminseite (nicht in der Auswahl).
export type Anliegen = 'gruppe' | 'firma' | 'kursleitung' | 'sonstiges' | 'termin';

export const ANLIEGEN: { wert: Anliegen; text: string }[] = [
  { wert: 'gruppe', text: 'Gruppe / Familie' },
  { wert: 'firma', text: 'Firma: Tagung, Workshop, Seminar' },
  { wert: 'kursleitung', text: 'Kursleitung: Kurs oder Retreat' },
  { wert: 'sonstiges', text: 'Sonstiges' },
];
export const ALLE_ANLIEGEN: Anliegen[] = [...ANLIEGEN.map((a) => a.wert), 'termin'];
export const ANREDE = ['Frau', 'Herr', 'Divers'];

export type Feld =
  | 'von' | 'bis' | 'offen' | 'zeitraum' | 'personen' | 'unternehmen' | 'uebernachtung'
  | 'thema' | 'name' | 'email' | 'telefon' | 'nachricht'
  | 'termin' | 'anrede' | 'vorname' | 'nachname';

// Welche Felder je Anliegen sichtbar sind und welche Pflicht.
// "von/bis" sind Pflicht, solange "offen" nicht angehakt ist; dann ist "zeitraum" Pflicht.
export const FELDER: Record<Anliegen, { sichtbar: Feld[]; pflicht: Feld[] }> = {
  gruppe: {
    sichtbar: ['von', 'bis', 'offen', 'zeitraum', 'personen', 'name', 'email', 'telefon', 'nachricht'],
    pflicht: ['von', 'bis', 'personen', 'name', 'email'],
  },
  firma: {
    sichtbar: ['unternehmen', 'von', 'bis', 'offen', 'zeitraum', 'personen', 'uebernachtung', 'name', 'email', 'telefon', 'nachricht'],
    pflicht: ['von', 'bis', 'personen', 'name', 'email'],
  },
  kursleitung: {
    sichtbar: ['thema', 'zeitraum', 'personen', 'name', 'email', 'telefon', 'nachricht'],
    pflicht: ['thema', 'zeitraum', 'name', 'email'],
  },
  sonstiges: {
    sichtbar: ['name', 'email', 'telefon', 'nachricht'],
    pflicht: ['name', 'email', 'nachricht'],
  },
  // Terminseite (Wireframe „Terminseite“, eigener Termin): alles Pflicht außer Nachricht
  termin: {
    sichtbar: ['termin', 'anrede', 'vorname', 'nachname', 'email', 'telefon', 'nachricht'],
    pflicht: ['termin', 'anrede', 'vorname', 'nachname', 'email', 'telefon'],
  },
};

export const BESCHRIFTUNG: Partial<Record<Anliegen, Partial<Record<Feld, string>>>> = {
  firma: { personen: 'Teilnehmende' },
  kursleitung: { zeitraum: 'Wunschzeitraum', personen: 'Erwartete Teilnehmende' },
  termin: { nachricht: 'Nachricht (freiwillig)' },
};

// Standardbeschriftungen, wo BESCHRIFTUNG nichts anderes sagt.
export const STANDARD: Partial<Record<Feld, string>> = {
  von: 'Anreise', bis: 'Abreise', zeitraum: 'Zeitraum', personen: 'Personen', unternehmen: 'Unternehmen', uebernachtung: 'Übernachtung',
  thema: 'Kurs oder Thema', name: 'Name', email: 'E-Mail', telefon: 'Telefon', nachricht: 'Nachricht',
  termin: 'Termin', anrede: 'Anrede', vorname: 'Vorname', nachname: 'Nachname',
};

export const UEBERNACHTUNG = ['ja', 'nein', 'teilweise', 'noch offen'];

/** Pflichtfelder unter Berücksichtigung des Hakens "Termin noch offen". */
export function pflichtfelder(anliegen: Anliegen, offen: boolean): Feld[] {
  const p = FELDER[anliegen].pflicht;
  if (!offen) return p;
  return [...p.filter((f) => f !== 'von' && f !== 'bis'), 'zeitraum'];
}

export const GRENZEN = { kurz: 200, nachricht: 5000, personenMax: 200 };
