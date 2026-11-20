// Bildwerte von Terminen und Kursleitungen auflösen (siehe src/lib/termin-felder.ts).
import type { ImageMetadata } from 'astro';
import { getImage } from 'astro:assets';
import { HAUSBILDER, type MedienGroesse } from './termin-felder';

const dateien = import.meta.glob<{ default: ImageMetadata }>('/src/assets/bilder/*.{webp,jpg,jpeg,png}', { eager: true });

export async function hausbildDatei(wert: string): Promise<ImageMetadata> {
  const h = HAUSBILDER.find((b) => 'haus/' + b.name === wert);
  const d = h && dateien[`/src/assets/bilder/${h.datei}`];
  if (!d) throw new Error(`Hausbild fehlt: ${wert}`);
  return d.default;
}

export function medienUrl(wert: string, groesse: MedienGroesse): string {
  return `/${wert}/${groesse}`;
}

// URL eines Bildes in gegebener Breite (für Teilen-Vorschau und Formular-Vorschaubilder)
export async function bildUrl(wert: string, breite: number, format: 'jpg' | 'webp' = 'jpg'): Promise<string> {
  if (wert.startsWith('haus/')) return (await getImage({ src: await hausbildDatei(wert), width: breite, format })).src;
  if (breite === 1200 && format === 'jpg') return medienUrl(wert, 'teilen'); // Teilen-Bild
  return medienUrl(wert, breite > 800 ? 'gross' : 'klein');
}
