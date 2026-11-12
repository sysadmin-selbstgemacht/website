#!/usr/bin/env node
// Bereitet Bilder für das öffentliche Repo vor (Regel in README: nur WebP, längste Kante max. 2.400 px).
//
// Aufruf:
//   npm run bilder -- <Quellordner> <Ziel-Unterordner> [--neu]
// Beispiel:
//   npm run bilder -- ~/OneDrive/Fotos/Auswahl-Start start
//   → schreibt nach src/assets/bilder/start/
//
// - liest JPG, JPEG, PNG, WebP, TIFF (HEIC nur, wenn die installierte sharp-Version es kann)
// - dreht nach EXIF-Ausrichtung, entfernt ALLE Metadaten (auch GPS und Kameradaten)
// - Dateinamen: klein, ohne Umlaute und Leerzeichen
// - bestehende Ziele werden übersprungen, außer mit --neu
// - warnt bei Bildern unter 1.200 px (zu klein für große Flächen)

import { readdir, mkdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const MAX = 2400;
const QUALITAET = 80;
const ENDUNGEN = new Set(['.jpg', '.jpeg', '.png', '.webp', '.tif', '.tiff', '.heic']);

const [quelle, ziel, ...rest] = process.argv.slice(2);
const neu = rest.includes('--neu');
if (!quelle || !ziel) {
  console.error('Aufruf: npm run bilder -- <Quellordner> <Ziel-Unterordner> [--neu]');
  process.exit(1);
}
if (!/^[a-z0-9-]+(\/[a-z0-9-]+)*$/.test(ziel)) {
  console.error('Ziel-Unterordner nur aus Kleinbuchstaben, Ziffern, "-" und "/" (z. B. "start" oder "firmen/raum").');
  process.exit(1);
}

const zielOrdner = path.join('src', 'assets', 'bilder', ziel);
await mkdir(zielOrdner, { recursive: true });

const name = (datei) =>
  path.parse(datei).name
    .toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'bild';

const dateien = (await readdir(quelle)).filter((d) => ENDUNGEN.has(path.extname(d).toLowerCase())).sort();
if (!dateien.length) {
  console.error(`Keine Bilder in ${quelle}.`);
  process.exit(1);
}

let summeVorher = 0, summeNachher = 0, fertig = 0;
const vergeben = new Set();
for (const d of dateien) {
  let n = name(d), i = 2;
  while (vergeben.has(n)) n = `${name(d)}-${i++}`;
  vergeben.add(n);
  const aus = path.join(zielOrdner, `${n}.webp`);
  if (existsSync(aus) && !neu) { console.log(`übersprungen  ${n}.webp (gibt es schon, --neu überschreibt)`); continue; }
  const ein = path.join(quelle, d);
  try {
    const bild = sharp(ein, { failOn: 'error' }).rotate(); // EXIF-Ausrichtung anwenden
    const meta = await bild.metadata();
    const info = await bild
      .resize({ width: MAX, height: MAX, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: QUALITAET })
      .toFile(aus); // sharp schreibt ohne Metadaten, solange nicht withMetadata() gesetzt ist
    const vorher = (await stat(ein)).size;
    summeVorher += vorher; summeNachher += info.size; fertig++;
    const klein = Math.max(info.width, info.height) < 1200 ? '  ⚠ unter 1.200 px' : '';
    console.log(`${n}.webp  ${info.width}×${info.height}  ${(vorher / 1e6).toFixed(1)} MB → ${(info.size / 1e3).toFixed(0)} KB${klein}${meta.orientation && meta.orientation > 1 ? '  (gedreht)' : ''}`);
  } catch (e) {
    console.error(`FEHLER  ${d}: ${e.message}`);
  }
}
console.log(`\n${fertig} Bilder nach ${zielOrdner}: ${(summeVorher / 1e6).toFixed(1)} MB → ${(summeNachher / 1e6).toFixed(1)} MB`);
