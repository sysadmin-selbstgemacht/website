// Prüft hochgeladene Bilder, bevor sie in R2 landen (ersetzt für diese Bilder den Bildwächter im Build).
// Regeln: WebP oder JPEG, 16:9, längste Kante max. 2.400 px, Größe begrenzt, keine Metadaten (EXIF/XMP).

import { MEDIEN_GROESSEN, MEDIEN_MAX_BYTES, type MedienGroesse } from '../src/lib/termin-felder';

export interface BildInfo { typ: 'image/webp' | 'image/jpeg'; breite: number; hoehe: number }

export function base64ZuBytes(b64: string): Uint8Array {
  const s = atob(b64.replace(/^data:[^,]*,/, ''));
  const a = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) a[i] = s.charCodeAt(i);
  return a;
}

const ascii = (b: Uint8Array, o: number, n: number) => String.fromCharCode(...b.subarray(o, o + n));
const u16le = (b: Uint8Array, o: number) => b[o] | (b[o + 1] << 8);
const u24le = (b: Uint8Array, o: number) => b[o] | (b[o + 1] << 8) | (b[o + 2] << 16);
const u32le = (b: Uint8Array, o: number) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;

function webp(b: Uint8Array): { breite: number; hoehe: number; meta: boolean } | null {
  if (b.length < 30 || ascii(b, 0, 4) !== 'RIFF' || ascii(b, 8, 4) !== 'WEBP') return null;
  let breite = 0, hoehe = 0, meta = false;
  for (let o = 12; o + 8 <= b.length; ) {
    const art = ascii(b, o, 4);
    const laenge = u32le(b, o + 4);
    const d = o + 8;
    if (art === 'VP8X') { breite = u24le(b, d + 4) + 1; hoehe = u24le(b, d + 7) + 1; if (b[d] & 0x0c) meta = true; }
    else if (art === 'VP8 ' && !breite) { breite = u16le(b, d + 6) & 0x3fff; hoehe = u16le(b, d + 8) & 0x3fff; }
    else if (art === 'VP8L' && !breite) {
      const v = u32le(b, d + 1);
      breite = (v & 0x3fff) + 1; hoehe = ((v >> 14) & 0x3fff) + 1;
    } else if (art === 'EXIF' || art === 'XMP ') meta = true;
    o = d + laenge + (laenge & 1);
  }
  return breite ? { breite, hoehe, meta } : null;
}

function jpeg(b: Uint8Array): { breite: number; hoehe: number; meta: boolean } | null {
  if (b.length < 4 || b[0] !== 0xff || b[1] !== 0xd8) return null;
  let o = 2, meta = false;
  while (o + 4 <= b.length) {
    if (b[o] !== 0xff) return null;
    const m = b[o + 1];
    if (m === 0xd8 || (m >= 0xd0 && m <= 0xd7) || m === 0x01) { o += 2; continue; }
    const laenge = (b[o + 2] << 8) | b[o + 3];
    if (m === 0xe1) meta = true; // APP1: EXIF oder XMP
    if (m === 0xed) meta = true; // APP13: IPTC
    if ((m >= 0xc0 && m <= 0xc3) || (m >= 0xc5 && m <= 0xc7) || (m >= 0xc9 && m <= 0xcb) || (m >= 0xcd && m <= 0xcf)) {
      return { hoehe: (b[o + 5] << 8) | b[o + 6], breite: (b[o + 7] << 8) | b[o + 8], meta };
    }
    if (m === 0xda) break;
    o += 2 + laenge;
  }
  return null;
}

export function pruefeBild(bytes: Uint8Array, groesse: MedienGroesse): { ok: true; info: BildInfo } | { ok: false; fehler: string } {
  if (bytes.length > MEDIEN_MAX_BYTES[groesse]) return { ok: false, fehler: `Bild zu groß (${(bytes.length / 1e6).toFixed(1)} MB)` };
  const w = webp(bytes);
  const j = w ? null : jpeg(bytes);
  const r = w ?? j;
  if (!r) return { ok: false, fehler: 'Bild muss WebP oder JPEG sein' };
  if (r.meta) return { ok: false, fehler: 'Bild enthält Metadaten (EXIF/XMP), bitte im Formular neu auswählen' };
  if (Math.max(r.breite, r.hoehe) > MEDIEN_GROESSEN[groesse]) return { ok: false, fehler: `Bild zu groß (${r.breite}×${r.hoehe} px)` };
  if (Math.abs(r.breite / r.hoehe / (16 / 9) - 1) > 0.01) return { ok: false, fehler: `Bild muss 16:9 sein (${r.breite}×${r.hoehe} px)` };
  if (r.breite < 320) return { ok: false, fehler: 'Bild zu klein' };
  return { ok: true, info: { typ: w ? 'image/webp' : 'image/jpeg', breite: r.breite, hoehe: r.hoehe } };
}
