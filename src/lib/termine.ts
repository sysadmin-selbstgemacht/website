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

// Kopfzeile der Terminseite (Wireframe): "01.–07. März 2027 Mo–So" bzw. "Fr 03.12.2026"
export function datumKopf(beginn: Date, ende: Date): string {
  const wt = (d: Date) => fmt({ weekday: 'short' }).format(d).replace('.', '');
  const tag = (d: Date) => fmt({ day: '2-digit' }).format(d);
  const monat = (d: Date) => fmt({ month: 'long' }).format(d);
  const jahr = (d: Date) => fmt({ year: 'numeric' }).format(d);
  if (beginn.toDateString() === ende.toDateString()) return `${wt(beginn)} ${fmt({ day: '2-digit', month: '2-digit', year: 'numeric' }).format(beginn)}`;
  const vorne = monat(beginn) === monat(ende) ? `${tag(beginn)}.` : `${tag(beginn)}. ${monat(beginn)}${jahr(beginn) === jahr(ende) ? '' : ' ' + jahr(beginn)} `;
  return `${vorne}–${tag(ende)}. ${monat(ende)} ${jahr(ende)} ${wt(beginn)}–${wt(ende)}`;
}

// Kachel „Termin“: "Montag, 01.03. bis Sonntag, 07.03.2027"
export function datumLang(beginn: Date, ende: Date): string {
  const lang = (d: Date, mitJahr: boolean) =>
    `${fmt({ weekday: 'long' }).format(d)}, ${fmt({ day: '2-digit', month: '2-digit', ...(mitJahr ? { year: 'numeric' } : {}) }).format(d)}`;
  if (beginn.toDateString() === ende.toDateString()) return lang(beginn, true);
  return `${lang(beginn, false)} bis ${lang(ende, true)}`;
}
