// Hilfen für Termine: Texte für Kategorien und Daten.
export const kategorieText = {
  veranstaltung: 'Veranstaltung',
  kurs: 'Kurs',
  retreat: 'Retreat',
  'das-laeuft-bei-uns': 'Das läuft bei uns',
} as const;

const fmt = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', ...o });

export function monatsName(d: Date): string {
  return fmt({ month: 'long', year: 'numeric' }).format(d);
}

export function datumText(beginn: Date, ende: Date): string {
  const tag = fmt({ day: 'numeric', month: 'numeric', year: 'numeric' });
  if (beginn.toDateString() === ende.toDateString()) return tag.format(beginn);
  return `${fmt({ day: 'numeric', month: 'numeric' }).format(beginn)}–${tag.format(ende)}`;
}
