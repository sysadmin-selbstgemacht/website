// Fotos des Hauses: eine Datei je Katalog-Nummer (Bildliste im Projekt: bildliste_canvas_2026-11-21.md).
// Export aus den Originalen: WebP, längste Kante 2.400 px, EXIF-Drehung angewandt, Metadaten entfernt.
// Astro erzeugt daraus beim Build AVIF und WebP in mehreren Breiten (Bild.astro).
// Bildnachweis: gesammelt im Impressum („Fotos:“), nicht unter den Bildern (Entscheidung 21.11.).
import type { ImageMetadata } from 'astro';

const dateien = import.meta.glob<{ default: ImageMetadata }>('/src/assets/bilder/katalog/*.webp', { eager: true });

// Katalog-Nr → Fotograf. Porträts ohne Katalog-Nr tragen das Präfix p.
export const FOTOGRAF = {
  '3': 'Marcus Dassler', '19': 'Marcus Dassler', '24': 'Marcus Dassler', '33': 'Marcus Dassler', '41': 'Marcus Dassler',
  '47': 'Marcus Dassler', '67': 'Marcus Dassler', '75': 'Marcus Dassler',
  '135': 'Karoline Wolf', '139': 'Karoline Wolf', '143': 'Karoline Wolf', '144': 'Karoline Wolf', '149': 'Karoline Wolf',
  '156': 'Karoline Wolf', '158': 'Karoline Wolf', '162': 'Karoline Wolf', '175': 'Karoline Wolf', '176': 'Karoline Wolf',
  '178': 'Karoline Wolf', '179': 'Karoline Wolf', '181': 'Karoline Wolf', '192': 'Karoline Wolf', '194': 'Karoline Wolf',
  '197': 'Karoline Wolf', '199': 'Karoline Wolf',
  '221': 'Hoppe', '232': 'Hoppe', '239': 'Hoppe', '241': 'Hoppe',
  '250': 'Michel Fleißner', '251': 'Michel Fleißner', '259': 'Michel Fleißner', '260': 'Michel Fleißner',
  '271': 'Michel Fleißner', '272': 'Michel Fleißner', '274': 'Michel Fleißner', '283': 'Michel Fleißner',
  '290': 'Michel Fleißner', '291': 'Michel Fleißner', '314': 'Michel Fleißner', '341': 'Michel Fleißner',
  '347': 'Michel Fleißner', '352': 'Michel Fleißner',
  '357': 'Sabine Finger',
  '429': 'Marcus Dassler', '430': 'Marcus Dassler', '433': 'Marcus Dassler', '435': 'Marcus Dassler',
  '478': 'Marcus Dassler', '527': 'Marcus Dassler', '534': 'Marcus Dassler',
  p83: 'Marcus Dassler', p389: 'Marcus Dassler', p420: 'Marcus Dassler',
} as const;

export type KatalogNr = keyof typeof FOTOGRAF;

/** Bilddatei zu einer Katalog-Nummer; bricht den Build ab, wenn sie fehlt. */
export function katalogBild(nr: KatalogNr): ImageMetadata {
  const praefix = /^\d+$/.test(nr) ? nr.padStart(3, '0') : nr;
  const treffer = Object.entries(dateien).find(([pfad]) => pfad.split('/').pop()!.startsWith(praefix + '-'));
  if (!treffer) throw new Error(`Katalogbild ${nr} fehlt in src/assets/bilder/katalog/`);
  return treffer[1].default;
}

/** Fotografen in fester Reihenfolge für den Bildnachweis im Impressum. */
export const FOTOGRAFEN = [...new Set(Object.values(FOTOGRAF))].sort((a, b) => a.localeCompare(b, 'de'));
