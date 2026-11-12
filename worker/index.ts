// Worker für selbst-gemacht.eu
//
// Liefert die statische Seite aus (ASSETS) und beantwortet nur /api/*.
//   GET  /api/anfrage/challenge  – ALTCHA-Aufgabe ausstellen
//   POST /api/anfrage/pruefen    – nur Lösung prüfen (Messseite /test/altcha/)
//   POST /api/anfrage            – Anfrage prüfen und verschicken (derzeit TROCKENLAUF)
//   GET  /api/test/smtp          – VORÜBERGEHEND: Erreichbarkeit des all-inkl-Mailservers
//   GET  /api/test/smtp-anmeldung – VORÜBERGEHEND: Anmeldung am Postfach prüfen, verschickt nichts
//
// Spamschutz nach Leitfaden (docs/formular.md), Reihenfolge:
//   1 verstecktes Feld → 2 Zeitprüfung → 3 Rate Limit → 4 Rechenaufgabe → 5 Feldprüfung
//
// Vor dem Go-live: Secret ALTCHA_SECRET setzen, Test-Rückfall und /api/test/* entfernen,
// Fehlermeldungen kürzen (siehe docs/go-live.md).

import { createChallenge, verifySolution, randomInt } from 'altcha-lib';
import { deriveKey } from 'altcha-lib/algorithms/web/pbkdf2';
import { connect } from 'cloudflare:sockets';
import { sende, SmtpFehler, type SmtpZugang } from './smtp';
import { ANLIEGEN, FELDER, BESCHRIFTUNG, STANDARD, GRENZEN, UEBERNACHTUNG, pflichtfelder, type Anliegen, type Feld } from '../src/lib/anfrage';

interface Env {
  ASSETS: Fetcher;
  ALTCHA_SECRET?: string;
  CF_VERSION_METADATA?: { id?: string };
  ANFRAGE_LIMIT?: { limit(o: { key: string }): Promise<{ success: boolean }> };
  MAIL_MODUS?: string; // 'senden' schaltet den Versand ein; sonst Trockenlauf
  MAIL_AN?: string; // Empfänger, mehrere mit Komma (Variable bei Cloudflare, nicht im Repo)
  MAIL_VON?: string; // Absender = Postfach des Hauses, z. B. noreply@selbst-gemacht.eu
  SMTP_HOST?: string; // Standard: w0129234.kasserver.com
  SMTP_PORT?: string; // Standard: 465 (TLS)
  SMTP_TLS?: string; // 'on' (Standard) oder 'off' (nur lokale Tests)
  SMTP_BENUTZER?: string; // Secret: Postfach-Kennung bei all-inkl (z. B. m0…)
  SMTP_PASSWORT?: string; // Secret
}

function zugang(env: Env): SmtpZugang | null {
  if (!env.SMTP_BENUTZER || !env.SMTP_PASSWORT) return null;
  return {
    host: env.SMTP_HOST || 'w0129234.kasserver.com',
    port: Number(env.SMTP_PORT || 465),
    tls: env.SMTP_TLS === 'off' ? 'off' : 'on',
    benutzer: env.SMTP_BENUTZER,
    passwort: env.SMTP_PASSWORT,
  };
}

const ALGORITHMUS = 'PBKDF2/SHA-256';
const KOSTEN = 2000; // wie k-a-d-o.com
const GUELTIG_S = 20 * 60; // kurz, weil Wiederverwendung nur je Isolate erkannt wird
const MIN_MS = 2000; // schneller ausgefüllt = Bot

const benutzt = new Map<string, number>(); // nonce -> Ablauf (ms); nur Zufallswerte

async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function schluessel(env: Env) {
  // TEST-RÜCKFALL: ohne Secret wird aus der Versions-ID abgeleitet (in Vorschauen fester Testwert).
  // Darf so nicht live gehen.
  const basis = env.ALTCHA_SECRET ?? 'nur-test:' + (env.CF_VERSION_METADATA?.id ?? 'vorschau');
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

async function altchaGueltig(env: Env, p: any): Promise<boolean> {
  if (!p?.challenge || !p?.solution) return false;
  const s = await schluessel(env);
  try {
    const r = await verifySolution({ challenge: p.challenge, solution: p.solution, deriveKey, hmacSignatureSecret: s.sig, hmacKeySignatureSecret: s.key });
    const nonce = p.challenge?.parameters?.nonce;
    const jetzt = Date.now();
    for (const [n, ablauf] of benutzt) if (ablauf < jetzt) benutzt.delete(n);
    if (!r.verified || typeof nonce !== 'string' || benutzt.has(nonce)) return false;
    benutzt.set(nonce, jetzt + GUELTIG_S * 1000);
    return true;
  } catch {
    return false;
  }
}

// ---------- Feldprüfung ----------
const text = (v: unknown, max = GRENZEN.kurz) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATUM = /^\d{4}-\d{2}-\d{2}$/;

function pruefeFelder(b: any) {
  const anliegen: Anliegen = ANLIEGEN.some((a) => a.wert === b.anliegen) ? b.anliegen : 'sonstiges';
  const offen = b.offen === true;
  const sichtbar = new Set<Feld>(FELDER[anliegen].sichtbar);
  const werte: Partial<Record<Feld, string>> = {};
  for (const f of sichtbar) {
    if (f === 'offen') continue;
    werte[f] = text(b[f], f === 'nachricht' ? GRENZEN.nachricht : GRENZEN.kurz);
  }
  if (offen) { delete werte.von; delete werte.bis; } else if (sichtbar.has('offen')) delete werte.zeitraum;

  const fehler: Record<string, string> = {};
  for (const f of pflichtfelder(anliegen, offen)) if (!werte[f]) fehler[f] = `${name(anliegen, f)} fehlt`;
  if (werte.email && !EMAIL.test(werte.email)) fehler.email = 'E-Mail-Adresse prüfen';
  for (const f of ['von', 'bis'] as const) if (werte[f] && !DATUM.test(werte[f]!)) fehler[f] = `${name(anliegen, f)}: Datum prüfen`;
  if (werte.von && werte.bis && werte.bis < werte.von) fehler.bis = `${name(anliegen, 'bis')} liegt vor ${name(anliegen, 'von')}`;
  if (werte.personen) {
    const n = Number(werte.personen);
    if (!Number.isInteger(n) || n < 1 || n > GRENZEN.personenMax) fehler.personen = `${name(anliegen, 'personen')}: Zahl prüfen`;
  }
  if (werte.uebernachtung && !UEBERNACHTUNG.includes(werte.uebernachtung)) fehler.uebernachtung = 'Übernachtung prüfen';
  return { anliegen, offen, werte, fehler };
}

function name(a: Anliegen, f: Feld): string {
  return BESCHRIFTUNG[a]?.[f] ?? STANDARD[f] ?? f;
}

function datumDE(iso?: string) {
  if (!iso) return '';
  const [j, m, t] = iso.split('-');
  return `${t}.${m}.${j}`;
}

function baueMail(p: ReturnType<typeof pruefeFelder>) {
  const { anliegen, werte: w } = p;
  const titel = ANLIEGEN.find((a) => a.wert === anliegen)!.text;
  const zeit = w.von ? `${datumDE(w.von)}–${datumDE(w.bis)}` : w.zeitraum ?? '';
  const betreff = ['Anfrage', titel.split(':')[0], w.personen ? `${w.personen} Pers.` : '', zeit, w.name].filter(Boolean).join(' · ');
  const zeilen = [`Anliegen: ${titel}`];
  for (const f of FELDER[anliegen].sichtbar) {
    if (f === 'offen' || f === 'nachricht') continue;
    const v = f === 'von' || f === 'bis' ? datumDE(w[f]) : w[f];
    if (v) zeilen.push(`${name(anliegen, f)}: ${v}`);
  }
  if (p.offen) zeilen.push('Termin: noch offen');
  if (w.nachricht) zeilen.push('', 'Nachricht:', w.nachricht);
  zeilen.push('', '—', 'Gesendet über das Anfrageformular auf selbst-gemacht.eu. „Antworten“ geht direkt an die anfragende Person.');
  return { betreff, antwortAn: w.email!, text: zeilen.join('\n') };
}

// ---------- Anfrage ----------
async function anfrage(request: Request, env: Env): Promise<Response> {
  let b: any;
  try { b = await request.json(); } catch { return json({ status: 'error', message: 'invalid_json' }, 400); }

  // 1 verstecktes Feld, 2 Zeitprüfung: still "ok", nichts senden (Bot lernt nichts)
  if (typeof b.sg_feld7 === 'string' && b.sg_feld7 !== '') return json({ status: 'ok' });
  const elapsed = Number(b.elapsed);
  if (!Number.isFinite(elapsed) || elapsed < MIN_MS) return json({ status: 'ok' });

  // 3 Rate Limit je IP (Cloudflare-Binding, je Standort, ungefähr)
  if (env.ANFRAGE_LIMIT) {
    const ip = request.headers.get('CF-Connecting-IP') ?? 'unbekannt';
    const { success } = await env.ANFRAGE_LIMIT.limit({ key: 'anfrage:' + ip });
    if (!success) return json({ status: 'error', message: 'rate_limited' }, 429);
  }

  // 4 Rechenaufgabe: sichtbarer Fehler
  if (!(await altchaGueltig(env, b.altcha))) return json({ status: 'error', message: 'verification_failed' }, 403);

  // 5 Feldprüfung
  const p = pruefeFelder(b);
  if (Object.keys(p.fehler).length) return json({ status: 'error', message: 'invalid', felder: p.fehler }, 400);

  const mail = baueMail(p);
  if (env.MAIL_MODUS !== 'senden') {
    const vorschau = `An: ${env.MAIL_AN ? '(hinterlegte Adresse)' : '(noch nicht hinterlegt)'}\nAntwort an: ${mail.antwortAn}\nBetreff: ${mail.betreff}\n\n${mail.text}`;
    return json({ status: 'ok', trockenlauf: vorschau });
  }
  const z = zugang(env);
  const an = (env.MAIL_AN ?? '').split(',').map((a) => a.trim()).filter(Boolean);
  if (!z || !env.MAIL_VON || !an.length) {
    console.error('Versand nicht eingerichtet: SMTP_BENUTZER, SMTP_PASSWORT, MAIL_VON oder MAIL_AN fehlt');
    return json({ status: 'error', message: 'versand_nicht_eingerichtet' }, 503);
  }
  try {
    await sende(z, { von: env.MAIL_VON, an, antwortAn: mail.antwortAn, betreff: mail.betreff, text: mail.text });
    return json({ status: 'ok' });
  } catch (e) {
    // Inhalt der Anfrage NICHT protokollieren, nur Schritt und Serverantwort
    console.error('Versand fehlgeschlagen', e instanceof SmtpFehler ? `${e.schritt}: ${e.antwort}` : String(e));
    return json({ status: 'error', message: 'versand_fehlgeschlagen' }, 502);
  }
}

// ---------- VORÜBERGEHEND: Erreichbarkeit all-inkl SMTP ----------
async function smtpTest(): Promise<Response> {
  const host = 'w0129234.kasserver.com';
  const ergebnis: Record<string, unknown> = { host };
  const lesen = async (reader: ReadableStreamDefaultReader<Uint8Array>) => {
    const t = setTimeout(() => reader.cancel().catch(() => {}), 8000);
    try { const { value } = await reader.read(); return value ? new TextDecoder().decode(value).trim() : '(leer)'; }
    finally { clearTimeout(t); }
  };
  for (const [port, art] of [[465, 'on'], [587, 'starttls']] as const) {
    const t0 = Date.now();
    try {
      const s = connect({ hostname: host, port }, { secureTransport: art, allowHalfOpen: false });
      const gruss = await lesen(s.readable.getReader());
      ergebnis[`port${port}`] = { ok: gruss.startsWith('220'), gruss: gruss.slice(0, 120), ms: Date.now() - t0 };
      await s.close();
    } catch (e) {
      ergebnis[`port${port}`] = { ok: false, fehler: String(e), ms: Date.now() - t0 };
    }
  }
  return json(ergebnis);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      return await bearbeiten(request, env);
    } catch (e) {
      console.error(e);
      // Vorschau-Stufe: Fehler sichtbar. Vor dem Go-live auf allgemeine Meldung kürzen.
      return json({ status: 'error', message: 'intern', detail: String(e) }, 500);
    }
  },
};

async function bearbeiten(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);

  if (url.pathname === '/api/anfrage/challenge' && request.method === 'GET') {
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
    return json({ ...challenge, _messung: { testSchluessel: s.test } });
  }

  if (url.pathname === '/api/anfrage' && request.method === 'POST') return anfrage(request, env);

  if (url.pathname === '/api/anfrage/pruefen' && request.method === 'POST') {
    let body: any;
    try { body = await request.json(); } catch { return json({ status: 'error', message: 'invalid_json' }, 400); }
    return (await altchaGueltig(env, body?.altcha))
      ? json({ status: 'ok', _messung: { serverMs: 0 } })
      : json({ status: 'error', message: 'verification_failed', _messung: { serverMs: 0 } }, 403);
  }

  if (url.pathname === '/api/test/smtp' && request.method === 'GET') return smtpTest();

  // VORÜBERGEHEND: Anmeldung prüfen. Ohne hinterlegte Zugangsdaten mit absichtlich falschen
  // (erwartet: Ablehnung 535). Verschickt nie etwas, gibt keine Zugangsdaten aus.
  if (url.pathname === '/api/test/smtp-anmeldung' && request.method === 'GET') {
    const echt = zugang(env);
    const z = echt ?? { host: env.SMTP_HOST || 'w0129234.kasserver.com', port: Number(env.SMTP_PORT || 465), tls: 'on' as const, benutzer: 'test-ungueltig', passwort: 'test-ungueltig' };
    try {
      const p = await sende(z, null, { nurAnmelden: true });
      return json({ zugangsdaten: echt ? 'hinterlegt' : 'Test (falsch)', ergebnis: 'Anmeldung erfolgreich', protokoll: p });
    } catch (e) {
      return json({ zugangsdaten: echt ? 'hinterlegt' : 'Test (falsch)', ergebnis: 'abgelehnt', schritt: e instanceof SmtpFehler ? e.schritt : 'unbekannt', antwort: e instanceof SmtpFehler ? e.antwort : String(e) });
    }
  }

  if (url.pathname.startsWith('/api/')) return json({ status: 'error', message: 'not_found' }, 404);
  return env.ASSETS.fetch(request);
}
