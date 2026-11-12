// Sitemap für Suchmaschinen.
// Feste Seiten kommen aus src/lib/seiten.ts, Termine aus src/content/termine/ (nur kommende,
// ohne Entwürfe). Ändert sich ein Termin, ist die Sitemap mit dem nächsten Build aktuell.
import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { SEITEN, type Seite } from '../lib/seiten';

export const GET: APIRoute = async ({ site }) => {
  const feste = (Object.values(SEITEN) as Seite[]).filter((s) => s.sitemap !== false).map((s) => s.pfad);
  const heute = new Date();
  heute.setHours(0, 0, 0, 0);
  const termine = (await getCollection('termine', (t) => !t.data.entwurf && t.data.ende >= heute)).map((t) => `/termine/${t.id}/`);
  const xml =
    '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    [...feste, ...termine].map((p) => `  <url><loc>${new URL(p, site).href}</loc></url>`).join('\n') +
    '\n</urlset>\n';
  return new Response(xml, { headers: { 'content-type': 'application/xml; charset=utf-8' } });
};
