#!/usr/bin/env node
// Bildwächter: läuft vor jedem Build (npm run build).
// Lässt den Build scheitern, wenn ein Bild im Repo gegen die Regeln verstößt.
// Damit kann kein Originalfoto ins öffentliche Repo, egal auf welchem Weg es kommt
// (Hand, Claude, Termin-Strecke). Regeln siehe README, Abschnitt „Bilder und Videos“.

import { readdir } from 'node:fs/promises';
import { statSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const ORDNER = ['src/assets', 'src/content', 'public'];
const MAX_KANTE = 2400;
const MAX_BYTES = 1_500_000; // 1,5 MB
const ERLAUBT = new Set(['.webp', '.jpg', '.jpeg', '.png', '.avif']);
const BILD = new Set([...ERLAUBT, '.heic', '.heif', '.tif', '.tiff', '.bmp', '.gif', '.raw', '.cr2', '.nef', '.dng']);
const AUSNAHMEN = new Set(['public/favicon.svg']); // SVG ist kein Foto

async function* dateien(dir) {
  let eintraege;
  try { eintraege = await readdir(dir, { withFileTypes: true }); } catch { return; }
  for (const e of eintraege) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) yield* dateien(p);
    else yield p;
  }
}

const fehler = [];
let geprueft = 0;
for (const o of ORDNER) {
  for await (const datei of dateien(o)) {
    const endung = path.extname(datei).toLowerCase();
    if (!BILD.has(endung) || AUSNAHMEN.has(datei)) continue;
    geprueft++;
    if (!ERLAUBT.has(endung)) { fehler.push(`${datei}: Format ${endung} nicht erlaubt (WebP oder JPG verwenden)`); continue; }
    const groesse = statSync(datei).size;
    if (groesse > MAX_BYTES) fehler.push(`${datei}: ${(groesse / 1e6).toFixed(1)} MB, erlaubt sind 1,5 MB`);
    try {
      const m = await sharp(datei).metadata();
      if (Math.max(m.width ?? 0, m.height ?? 0) > MAX_KANTE) fehler.push(`${datei}: ${m.width}×${m.height} px, längste Kante max. ${MAX_KANTE}`);
      if (m.exif || m.xmp || m.iptc) fehler.push(`${datei}: enthält Metadaten (EXIF/XMP/IPTC, evtl. GPS) – mit npm run bilder aufbereiten`);
    } catch (e) {
      fehler.push(`${datei}: nicht lesbar (${e.message})`);
    }
  }
}

if (fehler.length) {
  console.error(`\nBildwächter: ${fehler.length} Problem(e) – Build abgebrochen.\n`);
  for (const f of fehler) console.error('  ✘ ' + f);
  console.error('\nAbhilfe: Bilder mit `npm run bilder -- <Ordner> <Bereich>` aufbereiten.\n');
  process.exit(1);
}
console.log(`Bildwächter: ${geprueft} Bild(er) geprüft, alles in Ordnung.`);
