// Schlanker SMTP-Versand über das Postfach des Hauses bei all-inkl (docs/formular.md).
// Ein Gespräch pro Mail: Verbindung (TLS) → EHLO → AUTH LOGIN → MAIL FROM → RCPT TO → DATA → QUIT.
// Keine Fremdbibliothek, damit nichts Unbekanntes Zugang zum Postfach-Passwort hat.

import { connect } from 'cloudflare:sockets';

export interface SmtpZugang {
  host: string;
  port: number;
  tls: 'on' | 'off'; // 'on' = TLS von Anfang an (Port 465); 'off' nur für lokale Tests
  benutzer: string;
  passwort: string;
}

export interface Mail {
  von: string; // Absender (Postfach des Hauses)
  an: string[]; // Empfänger
  antwortAn?: string; // Reply-To: anfragende Person
  betreff: string;
  text: string;
}

export class SmtpFehler extends Error {
  constructor(public schritt: string, public antwort: string) {
    super(`${schritt}: ${antwort}`);
  }
}

const enc = new TextEncoder();
const b64 = (s: string) => btoa(String.fromCharCode(...enc.encode(s)));

/** Betreff mit Umlauten nach RFC 2047 (UTF-8, Base64), in Stücken unter 75 Zeichen. */
function kopfzeile(s: string): string {
  if (/^[\x20-\x7e]*$/.test(s)) return s;
  const teile: string[] = [];
  let stueck = '';
  for (const z of s) {
    if (b64(stueck + z).length > 45) { teile.push(stueck); stueck = ''; }
    stueck += z;
  }
  if (stueck) teile.push(stueck);
  return teile.map((t) => `=?UTF-8?B?${b64(t)}?=`).join('\r\n ');
}

/** Text als Base64 in 76er-Zeilen: sicher für Umlaute und lange Zeilen. */
function koerper(text: string): string {
  return (b64(text.replace(/\r?\n/g, '\r\n')).match(/.{1,76}/g) ?? []).join('\r\n');
}

const nurAdresse = (a: string) => {
  const s = a.trim();
  if (!/^[^\s<>@"]+@[^\s<>@"]+$/.test(s)) throw new SmtpFehler('adresse', `ungültig: ${s}`);
  return s;
};

export function baueNachricht(m: Mail, jetzt = new Date()): string {
  const domain = m.von.split('@')[1] ?? 'localhost';
  const kopf = [
    `From: SELBSTGEMACHT Website <${nurAdresse(m.von)}>`,
    `To: ${m.an.map(nurAdresse).join(', ')}`,
    ...(m.antwortAn ? [`Reply-To: ${nurAdresse(m.antwortAn)}`] : []),
    `Subject: ${kopfzeile(m.betreff)}`,
    `Date: ${jetzt.toUTCString().replace('GMT', '+0000')}`,
    `Message-ID: <${crypto.randomUUID()}@${domain}>`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    'Auto-Submitted: auto-generated',
  ];
  return kopf.join('\r\n') + '\r\n\r\n' + koerper(m.text) + '\r\n';
}

/** Liest eine vollständige SMTP-Antwort (auch mehrzeilig, "250-…" bis "250 …"). */
async function antwortLeser(reader: ReadableStreamDefaultReader<Uint8Array>) {
  const dec = new TextDecoder();
  let puffer = '';
  return async (ms = 15000): Promise<{ code: number; text: string }> => {
    const ende = Date.now() + ms;
    for (;;) {
      const zeilen = puffer.split('\r\n');
      for (let i = 0; i < zeilen.length - 1; i++) {
        if (/^\d{3} /.test(zeilen[i])) {
          const text = zeilen.slice(0, i + 1).join('\n');
          puffer = zeilen.slice(i + 1).join('\r\n');
          return { code: Number(zeilen[i].slice(0, 3)), text };
        }
      }
      if (Date.now() > ende) throw new SmtpFehler('zeitlimit', puffer.slice(0, 200) || '(keine Antwort)');
      const { value, done } = await reader.read();
      if (done) throw new SmtpFehler('verbindung', 'vom Server geschlossen');
      puffer += dec.decode(value, { stream: true });
    }
  };
}

export interface Protokoll {
  schritt: string;
  code: number;
}

/**
 * Verschickt eine Mail. Mit `nurAnmelden: true` wird nach der Anmeldung abgebrochen
 * (Test der Zugangsdaten, es geht nichts raus).
 */
export async function sende(z: SmtpZugang, m: Mail | null, opt: { nurAnmelden?: boolean } = {}): Promise<Protokoll[]> {
  const protokoll: Protokoll[] = [];
  const s = connect({ hostname: z.host, port: z.port }, { secureTransport: z.tls, allowHalfOpen: false });
  const writer = s.writable.getWriter();
  const lies = await antwortLeser(s.readable.getReader());
  const schreib = (zeile: string) => writer.write(enc.encode(zeile + '\r\n'));
  const erwarte = async (schritt: string, ok: number[]) => {
    const a = await lies();
    protokoll.push({ schritt, code: a.code });
    if (!ok.includes(a.code)) throw new SmtpFehler(schritt, a.text.slice(0, 200));
    return a;
  };
  try {
    await erwarte('begruessung', [220]);
    await schreib(`EHLO ${m?.von.split('@')[1] ?? 'selbst-gemacht.eu'}`);
    await erwarte('ehlo', [250]);
    await schreib('AUTH LOGIN');
    await erwarte('auth', [334]);
    await schreib(b64(z.benutzer));
    await erwarte('auth-benutzer', [334]);
    await schreib(b64(z.passwort));
    await erwarte('auth-passwort', [235]);
    if (opt.nurAnmelden || !m) {
      await schreib('QUIT');
      return protokoll;
    }
    await schreib(`MAIL FROM:<${nurAdresse(m.von)}>`);
    await erwarte('mail-from', [250]);
    for (const a of m.an) {
      await schreib(`RCPT TO:<${nurAdresse(a)}>`);
      await erwarte('rcpt-to', [250, 251]);
    }
    await schreib('DATA');
    await erwarte('data', [354]);
    // Punkt am Zeilenanfang verdoppeln (RFC 5321, 4.5.2); Base64-Körper enthält keine, Kopf vorsichtshalber
    const roh = baueNachricht(m).replace(/\r\n\./g, '\r\n..');
    await writer.write(enc.encode(roh + '.\r\n'));
    await erwarte('nachricht', [250]);
    await schreib('QUIT');
    return protokoll;
  } finally {
    try { await writer.close(); } catch {}
    try { await s.close(); } catch {}
  }
}
