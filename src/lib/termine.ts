// Hilfen für Termine: Daten, Uhrzeiten, Dauer.
import { naechte } from './termin-felder';

const fmt = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', ...o });

export function monatsName(d: Date): string {
  return fmt({ month: 'long', year: 'numeric' }).format(d);
}

export function datumText(beginn: Date, ende: Date): string {
  const tag = fmt({ day: 'numeric', month: 'numeric', year: 'numeric' });
  if (beginn.toDateString() === ende.toDateString()) return tag.format(beginn);
  return `${fmt({ day: 'numeric', month: 'numeric' }).format(beginn)}–${tag.format(ende)}`;
}

// "Fr 3.12." für die Terminliste (Datum vorn, fett mit Wochentag; Briefing 20.11. Abschnitt 2)
export function datumKurz(d: Date): string {
  return fmt({ weekday: 'short', day: 'numeric', month: 'numeric' }).format(d).replace(',', '');
}

export function istMehrtaegig(t: { beginn: Date; ende: Date }): boolean {
  return naechte(t.beginn, t.ende) > 0;
}

// eintägig: "18:00–21:00 Uhr"; mehrtägig: "Anreise 16:00 Uhr · Abreise 11:00 Uhr"
export function uhrzeitText(t: { beginn: Date; ende: Date; uhrzeit_beginn: string; uhrzeit_ende: string }): string {
  return istMehrtaegig(t)
    ? `Anreise ${t.uhrzeit_beginn} Uhr · Abreise ${t.uhrzeit_ende} Uhr`
    : `${t.uhrzeit_beginn}–${t.uhrzeit_ende} Uhr`;
}

export function dauerText(t: { beginn: Date; ende: Date }): string {
  const n = naechte(t.beginn, t.ende);
  return n === 0 ? 'eintägig' : `${n} ${n === 1 ? 'Nacht' : 'Nächte'}`;
}

export function namenText(namen: string[]): string {
  return namen.length <= 1 ? (namen[0] ?? '') : `${namen.slice(0, -1).join(', ')} und ${namen.at(-1)}`;
}
