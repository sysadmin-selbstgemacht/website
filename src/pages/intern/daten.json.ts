// Stand von main für das Termin-Formular: alle Termine und Kursleitungen mit ihren Rohwerten.
// Nur hinter der Anmeldung erreichbar (Worker prüft /intern/*). Nicht in der Sitemap.
import type { APIRoute } from 'astro';
import { lesen } from '../../lib/frontmatter';
import { bildUrl } from '../../lib/medien';
import { HAUSBILDER } from '../../lib/termin-felder';

const termine = import.meta.glob<string>('/src/content/termine/*.md', { query: '?raw', import: 'default', eager: true });
const leitungen = import.meta.glob<string>('/src/content/kursleitungen/*.json', { query: '?raw', import: 'default', eager: true });
const kennung = (pfad: string) => pfad.split('/').pop()!.replace(/\.(md|json)$/, '');

export const GET: APIRoute = async () => {
  const t = [];
  for (const [pfad, roh] of Object.entries(termine)) {
    const { daten, text } = lesen(roh);
    t.push({ id: kennung(pfad), daten, text, vorschau: typeof daten.bild === 'string' ? await bildUrl(daten.bild, 480, 'webp') : null });
  }
  const l = [];
  for (const [pfad, roh] of Object.entries(leitungen)) {
    const daten = JSON.parse(roh);
    l.push({ id: kennung(pfad), daten, vorschau: typeof daten.foto === 'string' ? await bildUrl(daten.foto, 480, 'webp') : null });
  }
  const h = [];
  for (const b of HAUSBILDER) h.push({ wert: 'haus/' + b.name, titel: b.titel, alt: b.alt, vorschau: await bildUrl('haus/' + b.name, 480, 'webp') });
  return new Response(JSON.stringify({ stand: new Date().toISOString(), termine: t, kursleitungen: l, hausbilder: h }), {
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
};
