// Worker für selbst-gemacht.eu
//
// Liefert die statische Seite aus (ASSETS) und beantwortet nur /api/*.
// Stand 11.11.2026: MESS-STUFE für den Spamschutz (Architektur D-13).
// /api/anfrage/challenge  – stellt eine ALTCHA-Aufgabe aus
// /api/anfrage/pruefen    – prüft eine Lösung, versendet NICHTS
//
// Vor dem echten Formular: Secret ALTCHA_SECRET setzen und den Test-Rückfall entfernen
// (siehe docs/formular.md).

import { createChallenge, verifySolution, randomInt } from 'altcha-lib';
import { deriveKey } from 'altcha-lib/algorithms/web/pbkdf2';

interface Env {
  ASSETS: Fetcher;
  ALTCHA_SECRET?: string;
  CF_VERSION_METADATA: { id: string };
}

const ALGORITHMUS = 'PBKDF2/SHA-256';
const KOSTEN = 2000; // wie k-a-d-o.com
const GUELTIG_S = 20 * 60; // kurz, weil Wiederverwendung nur je Isolate erkannt wird

const benutzt = new Map<string, number>(); // nonce -> Ablauf (ms); nur Zufallswerte

async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function schluessel(env: Env) {
  // TEST-RÜCKFALL: ohne Secret wird aus der Versions-ID abgeleitet.
  // Nur für die Messung; das Formular darf so nicht live gehen.
  const basis = env.ALTCHA_SECRET ?? 'nur-test:' + env.CF_VERSION_METADATA.id;
  return {
    sig: await sha256Hex('altcha-sig:' + basis),
    key: await sha256Hex('altcha-key:' + basis),
    test: !env.ALTCHA_SECRET,
  };
}

function json(daten: unknown, status = 200) {
  return new Response(JSON.stringify(daten), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });
}

function raeumen() {
  const jetzt = Date.now();
  for (const [n, ablauf] of benutzt) if (ablauf < jetzt) benutzt.delete(n);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/api/anfrage/challenge' && request.method === 'GET') {
      const t0 = Date.now();
      const s = await schluessel(env);
      const challenge = await createChallenge({
        algorithm: ALGORITHMUS,
        cost: KOSTEN,
        counter: randomInt(5000, 10000),
        deriveKey,
        expiresAt: Math.floor(Date.now() / 1000) + GUELTIG_S,
        hmacSignatureSecret: s.sig,
        hmacKeySignatureSecret: s.key,
      });
      return json({ ...challenge, _messung: { serverMs: Date.now() - t0, testSchluessel: s.test } });
    }

    if (url.pathname === '/api/anfrage/pruefen' && request.method === 'POST') {
      const t0 = Date.now();
      let body: any;
      try {
        body = await request.json();
      } catch {
        return json({ status: 'error', message: 'invalid_json' }, 400);
      }
      const p = body?.altcha;
      if (!p?.challenge || !p?.solution) return json({ status: 'error', message: 'verification_failed' }, 403);
      const s = await schluessel(env);
      let ok = false;
      try {
        const r = await verifySolution({
          challenge: p.challenge,
          solution: p.solution,
          deriveKey,
          hmacSignatureSecret: s.sig,
          hmacKeySignatureSecret: s.key,
        });
        const nonce = p.challenge?.parameters?.nonce;
        raeumen();
        ok = !!r.verified && typeof nonce === 'string' && !benutzt.has(nonce);
        if (ok) benutzt.set(nonce, Date.now() + GUELTIG_S * 1000);
      } catch {
        ok = false;
      }
      const ms = Date.now() - t0;
      return ok
        ? json({ status: 'ok', _messung: { serverMs: ms } })
        : json({ status: 'error', message: 'verification_failed', _messung: { serverMs: ms } }, 403);
    }

    if (url.pathname.startsWith('/api/')) return json({ status: 'error', message: 'not_found' }, 404);
    return env.ASSETS.fetch(request);
  },
};
