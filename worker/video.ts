// Videos aus R2 ausliefern: GET/HEAD /medien/video/<name>.<webm|mp4>
// Nur Schlüssel aus src/lib/videos.ts. Unterstützt Range-Anfragen (Safari und Spulen brauchen sie).
import { VIDEOS, type VideoName, type VideoFormat } from '../src/lib/videos';

export async function video(request: Request, bucket: R2Bucket | undefined): Promise<Response> {
  const m = /^\/medien\/video\/([a-z0-9-]+)\.(webm|mp4)$/.exec(new URL(request.url).pathname);
  const eintrag = m && (VIDEOS as Record<string, Partial<Record<VideoFormat, string>>>)[m[1] as VideoName];
  const schluessel = eintrag?.[m![2] as VideoFormat];
  if (!schluessel || !bucket || (request.method !== 'GET' && request.method !== 'HEAD')) return new Response('Nicht gefunden', { status: 404 });

  const h = new Headers({
    'content-type': m![2] === 'webm' ? 'video/webm' : 'video/mp4',
    'accept-ranges': 'bytes',
    'cache-control': 'public, max-age=86400',
    'x-content-type-options': 'nosniff',
  });
  if (request.method === 'HEAD') {
    const k = await bucket.head(schluessel);
    if (!k) return new Response('Nicht gefunden', { status: 404 });
    h.set('content-length', String(k.size));
    h.set('etag', k.httpEtag);
    return new Response(null, { headers: h });
  }
  const bereich = request.headers.get('range');
  const o = await bucket.get(schluessel, bereich ? { range: request.headers } : undefined);
  if (!o) return new Response('Nicht gefunden', { status: 404 });
  h.set('etag', o.httpEtag);
  if (bereich && o.range) {
    const r = o.range as { offset?: number; length?: number; suffix?: number };
    const start = r.suffix !== undefined ? Math.max(0, o.size - r.suffix) : r.offset ?? 0;
    const laenge = r.suffix !== undefined ? o.size - start : r.length ?? o.size - start;
    h.set('content-range', `bytes ${start}-${start + laenge - 1}/${o.size}`);
    h.set('content-length', String(laenge));
    return new Response(o.body, { status: 206, headers: h });
  }
  h.set('content-length', String(o.size));
  return new Response(o.body, { headers: h });
}
