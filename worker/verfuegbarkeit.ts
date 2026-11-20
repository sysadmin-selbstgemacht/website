// Verfügbarkeit des Hauses für Gruppen, aus 3RPMS (nur lesend).
//
//   GET /api/verfuegbarkeit  →  { status: 'ok', von, bis, belegt: ['JJJJ-MM-TT', …], stand }
//
// Regel (Architekturentscheidungen 4, 20.11.2026):
//   - Es zählen nur die Zimmer 01–10 (Hofladen, Seminarraum, Teichterrasse, Baumzelt nicht).
//   - Eine Nacht ist belegt, sobald eines dieser Zimmer für sie gebucht ist.
//   - „belegt“ listet Nächte: Ein Aufenthalt 28.12.–01.01. belegt die Nächte 28.–31.12.
//     Der Abreisetag ist damit frei für die nächste Anreise.
//   - Aufenthalte ohne zugewiesenes Zimmer zählen nicht (Zimmer werden bei Buchung sofort zugewiesen).
//
// Die Seite bekommt nur Daten, keine Gäste- oder Zimmerangaben.
// Zwischenspeicher 15 Minuten: im Isolate und, wo verfügbar, im Cloudflare-Cache.
// Ohne Secret RPMS_TOKEN (z. B. in Vorschauen) oder bei Fehlern: { status: 'nicht_verfuegbar' }.
// Der Kalender lässt dann alle Tage wählbar und weist darauf hin.

import { KALENDER_MONATE } from '../src/lib/anfrage';

export interface VerfuegbarkeitEnv {
  RPMS_TOKEN?: string; // Secret, nur Production
}

const ENDPUNKT = 'https://www.3rpms.de/graphql';
const HAUS_ZIMMER = new Set(['01', '02', '03', '04', '05', '06', '07', '08', '09', '10']);
const CACHE_S = 15 * 60;
const MAX_SEITEN = 30; // je 100 Aufenthalte; Schutz vor Endlosschleife und Subrequest-Grenze
const CACHE_SCHLUESSEL = 'https://verfuegbarkeit.intern/v1';

let gemerkt: { bis: number; daten: Ergebnis } | null = null;

interface Ergebnis { status: 'ok'; von: string; bis: string; belegt: string[]; stand: string }

const ISO = (d: Date) => d.toISOString().slice(0, 10);
function tagePlus(iso: string, n: number) {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return ISO(d);
}
/** heute in Deutschland */
function heute() {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Berlin' }).format(new Date());
}

const ABFRAGE = `query($von: Date!, $bis: Date!, $nach: String) {
  room_stays(filter: { reservation_from: { lt: $bis }, reservation_to: { gt: $von } }, first: 100, after: $nach) {
    edges { node { reservation_from reservation_to room_setup { name } } }
    pageInfo { hasNextPage endCursor }
  }
}`;

async function abrufen(token: string): Promise<Ergebnis> {
  const von = heute();
  const ende = new Date(von + 'T00:00:00Z');
  ende.setUTCMonth(ende.getUTCMonth() + KALENDER_MONATE);
  const bis = ISO(ende);

  const belegt = new Set<string>();
  let nach: string | null = null;
  for (let seite = 0; seite < MAX_SEITEN; seite++) {
    const r = await fetch(ENDPUNKT, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ query: ABFRAGE, variables: { von, bis, nach } }),
    });
    const j: any = await r.json().catch(() => null);
    if (!r.ok || !j || j.errors) throw new Error(`3RPMS ${r.status}: ${JSON.stringify(j?.errors ?? '').slice(0, 300)}`);
    const rs = j.data.room_stays;
    for (const { node } of rs.edges) {
      if (!HAUS_ZIMMER.has(node.room_setup?.name)) continue;
      // Nächte von der Anreise bis zum Tag vor der Abreise, begrenzt auf den Zeitraum
      for (let t = node.reservation_from < von ? von : node.reservation_from; t < node.reservation_to && t < bis; t = tagePlus(t, 1)) belegt.add(t);
    }
    if (!rs.pageInfo.hasNextPage) return { status: 'ok', von, bis, belegt: [...belegt].sort(), stand: new Date().toISOString() };
    nach = rs.pageInfo.endCursor;
  }
  throw new Error('3RPMS: zu viele Seiten');
}

function antwort(daten: unknown, sekunden: number) {
  return new Response(JSON.stringify(daten), {
    headers: { 'content-type': 'application/json', 'cache-control': `public, max-age=${sekunden}` },
  });
}

export async function verfuegbarkeit(env: VerfuegbarkeitEnv): Promise<Response> {
  if (!env.RPMS_TOKEN) return antwort({ status: 'nicht_verfuegbar', grund: 'kein_zugang' }, 60);

  if (gemerkt && gemerkt.bis > Date.now()) return antwort(gemerkt.daten, CACHE_S);

  // Cloudflare-Cache (wirkt nicht hinter Cloudflare Access und nicht auf jeder Adresse; dann nur Isolate)
  const cache = (globalThis as any).caches?.default as Cache | undefined;
  try {
    const treffer = await cache?.match(CACHE_SCHLUESSEL);
    if (treffer) {
      const daten = (await treffer.json()) as Ergebnis;
      gemerkt = { bis: Date.now() + CACHE_S * 1000, daten };
      return antwort(daten, CACHE_S);
    }
  } catch { /* Cache nicht verfügbar */ }

  try {
    const daten = await abrufen(env.RPMS_TOKEN);
    gemerkt = { bis: Date.now() + CACHE_S * 1000, daten };
    try { await cache?.put(CACHE_SCHLUESSEL, antwort(daten, CACHE_S)); } catch { /* egal */ }
    return antwort(daten, CACHE_S);
  } catch (e) {
    console.error('Verfügbarkeit', String(e)); // ohne Schlüssel, ohne Gästedaten
    return antwort({ status: 'nicht_verfuegbar', grund: 'fehler' }, 60);
  }
}
