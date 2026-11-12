// Sitemap für Suchmaschinen: alle öffentlichen Seiten und veröffentlichten Termine.
// Testseiten (/test/), 404 und die Sitemap selbst sind ausgenommen.
import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';

const SEITEN = [
  '/', '/gruppen-und-familien/', '/firmen/', '/kursleitende/', '/termine/', '/ueber-uns/', '/impressum/', '/datenschutz/',
];

export const GET: APIRoute = async ({ site }) => {
  const termine = await getCollection('termine', (t) => !t.data.entwurf);
  const heute = new Date();
  heute.setHours(0, 0, 0, 0);
  const pfade = [...SEITEN, ...termine.filter((t) => t.data.ende >= heute).map((t) => `/termine/${t.id}/`)];
  const xml =
    '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    pfade.map((p) => `  <url><loc>${new URL(p, site).href}</loc></url>`).join('\n') +
    '\n</urlset>\n';
  return new Response(xml, { headers: { 'content-type': 'application/xml; charset=utf-8' } });
};
