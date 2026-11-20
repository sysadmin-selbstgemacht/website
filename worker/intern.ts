// Termin-Formular: geschützter Bereich /intern/* und /api/intern/*, dazu die Bildauslieferung /medien/*.
//
// Zugang: Cloudflare Access (Anmeldung per Mailcode). Der Worker prüft zusätzlich das Access-Token
// (Signatur, Zielgruppe, Ablauf) und die Mailadresse gegen INTERN_ERLAUBT. Fehlt die Einrichtung,
// bleibt alles gesperrt.
//
// Ablauf jeder Änderung: Branch termin/<kennung> bzw. kursleitung/<kennung> → Commit → Pull Request
// → Vorschau (Workers Builds) → „Veröffentlichen“ (Squash-Merge, nur bei grüner Prüfung).
// Bilder liegen in R2 (Binding MEDIEN), nie im Repo. Siehe docs/termin-formular.md.
//
//   GET  /medien/<schlüssel>/<klein|gross>   öffentlich: Bild aus R2
//   GET  /api/intern/stand                    Termine und Kursleitungen auf main, offene Entwürfe
//   GET  /api/intern/termin?id=               ein Termin (Entwurf, sonst main)
//   GET  /api/intern/kursleitung?id=          eine Kursleitung (Entwurf, sonst main)
//   POST /api/intern/termin                   speichern (neu, bearbeiten, kopie)
//   POST /api/intern/termin/loeschen          Löschen als Entwurf anlegen
//   POST /api/intern/kursleitung              speichern
//   POST /api/intern/kursleitung/loeschen     Löschen als Entwurf anlegen (nur wenn kein Termin sie nutzt)
//   GET  /api/intern/status?pr=               Stand der Prüfung, Vorschau-Link
//   POST /api/intern/veroeffentlichen         Entwurf veröffentlichen (Merge)
//   POST /api/intern/verwerfen                Entwurf verwerfen

import { Github, GithubFehler, type Datei } from './github';
import { base64ZuBytes, pruefeBild } from './bild';
import { lesen, schreiben, FrontmatterFehler, type Wert } from '../src/lib/frontmatter';
import {
  GRENZEN_TERMIN as T, GRENZEN_LEITUNG as L, VERPFLEGUNG_WERTE, UST_WERTE, UHRZEIT, DATUM_ISO, HAUSBILD_NAMEN,
  beschreibungMarkdown, beschreibungText, kurzname, naechte, type MedienGroesse,
} from '../src/lib/termin-felder';

export interface InternEnv {
  ASSETS: Fetcher;
  MEDIEN?: R2Bucket;
  GITHUB_TOKEN?: string; // Secret
  GITHUB_REPO?: string;
  ACCESS_TEAM?: string; // z. B. "selbstgemacht" für selbstgemacht.cloudflareaccess.com
  ACCESS_AUD?: string; // Application Audience (AUD) Tag der Access-Anwendung
  INTERN_ERLAUBT?: string; // Mailadressen, mit Komma getrennt
  INTERN_LOKAL?: string; // "ja": ohne Access, NUR auf localhost (wrangler dev)
  VORSCHAU_HOST?: string; // workers.dev-Adresse des Workers, Basis der Vorschau-Adressen
}

const TERMINE = 'src/content/termine';
const LEITUNGEN = 'src/content/kursleitungen';

function json(daten: unknown, status = 200) {
  return new Response(JSON.stringify(daten), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
}
const fehler = (status: number, message: string, extra: Record<string, unknown> = {}) => json({ status: 'error', message, ...extra }, status);

// ---------- Zugang ----------
let schluesselCache: { team: string; ablauf: number; keys: any[] } | null = null;

function b64url(s: string): Uint8Array {
  return base64ZuBytes(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4));
}

async function accessMail(request: Request, env: InternEnv): Promise<string | null> {
  const url = new URL(request.url);
  if (env.INTERN_LOKAL === 'ja' && (url.hostname === 'localhost' || url.hostname === '127.0.0.1')) return 'lokal@test';
  if (!env.ACCESS_TEAM || !env.ACCESS_AUD || !env.INTERN_ERLAUBT) return null;
  const token = request.headers.get('cf-access-jwt-assertion');
  if (!token) return null;
  const [kopf, nutz, sig] = token.split('.');
  if (!kopf || !nutz || !sig) return null;
  const h = JSON.parse(new TextDecoder().decode(b64url(kopf)));
  const p = JSON.parse(new TextDecoder().decode(b64url(nutz)));
  const aussteller = `https://${env.ACCESS_TEAM}.cloudflareaccess.com`;
  if (h.alg !== 'RS256' || p.iss !== aussteller) return null;
  const aud = Array.isArray(p.aud) ? p.aud : [p.aud];
  if (!aud.includes(env.ACCESS_AUD) || typeof p.exp !== 'number' || p.exp * 1000 < Date.now()) return null;

  if (!schluesselCache || schluesselCache.team !== env.ACCESS_TEAM || schluesselCache.ablauf < Date.now()) {
    const r = await fetch(`${aussteller}/cdn-cgi/access/certs`);
    if (!r.ok) return null;
    schluesselCache = { team: env.ACCESS_TEAM, ablauf: Date.now() + 3600_000, keys: ((await r.json()) as any).keys ?? [] };
  }
  const jwk = schluesselCache.keys.find((k) => k.kid === h.kid);
  if (!jwk) return null;
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const gueltig = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64url(sig), new TextEncoder().encode(`${kopf}.${nutz}`));
  if (!gueltig) return null;
  const mail = String(p.email ?? '').toLowerCase();
  const erlaubt = env.INTERN_ERLAUBT.split(',').map((m) => m.trim().toLowerCase()).filter(Boolean);
  return erlaubt.includes(mail) ? mail : null;
}

// ---------- Hilfen ----------
type Stand = {
  termine: { id: string; daten: Record<string, Wert>; text: string }[];
  kursleitungen: { id: string; daten: Record<string, any> }[];
};

async function standMain(request: Request, env: InternEnv): Promise<Stand> {
  const r = await env.ASSETS.fetch(new Request(new URL('/intern/daten.json', request.url)));
  if (!r.ok) throw new Error('daten.json fehlt');
  return (await r.json()) as Stand;
}

const zahl = (v: unknown): number | undefined => {
  if (v === '' || v === null || v === undefined) return undefined;
  const n = typeof v === 'number' ? v : Number(String(v).replace(/\s|€/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.'));
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : NaN;
};
const txt = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max + 1) : '');
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Kennungen kurz halten: Cloudflare bildet daraus die Vorschau-Adresse
// (<branch>-selbst-gemacht.…workers.dev, ein Adressteil darf höchstens 63 Zeichen haben).
const TITEL_KURZ = 25;
const NAME_KURZ = 30;
const zufall = () => [...crypto.getRandomValues(new Uint8Array(4))].map((b) => b.toString(36).padStart(2, '0')).join('').slice(0, 6);

function datumDE(iso: string) {
  const [j, m, t] = iso.split('-');
  return `${+t}.${+m}.${j}`;
}

function istMedien(w: unknown): w is string {
  return typeof w === 'string' && w.startsWith('medien/');
}

async function medienLoeschen(env: InternEnv, werte: (string | null | undefined)[]) {
  if (!env.MEDIEN) return;
  const keys = werte.filter(istMedien).flatMap((w) => [`${w}/gross`, `${w}/klein`]);
  if (keys.length) await env.MEDIEN.delete(keys);
}

// Neues Bild prüfen und in R2 ablegen. Liefert den Bildwert ("medien/…").
async function medienAblegen(env: InternEnv, bereich: 'termine' | 'kursleitungen', kennung: string, bild: any): Promise<{ wert?: string; fehler?: string }> {
  if (!env.MEDIEN) return { fehler: 'Bildspeicher nicht eingerichtet' };
  const teile: Record<MedienGroesse, Uint8Array> = { gross: new Uint8Array(), klein: new Uint8Array() };
  const typen: Record<string, string> = {};
  for (const g of ['gross', 'klein'] as const) {
    if (typeof bild?.[g] !== 'string') return { fehler: 'Bild fehlt' };
    let bytes: Uint8Array;
    try { bytes = base64ZuBytes(bild[g]); } catch { return { fehler: 'Bild nicht lesbar' }; }
    const p = pruefeBild(bytes, g);
    if (!p.ok) return { fehler: p.fehler };
    teile[g] = bytes;
    typen[g] = p.info.typ;
  }
  const wert = `medien/${bereich}/${kennung.slice(0, 80)}-${zufall()}`;
  for (const g of ['gross', 'klein'] as const) {
    await env.MEDIEN.put(`${wert}/${g}`, teile[g], { httpMetadata: { contentType: typen[g], cacheControl: 'public, max-age=31536000, immutable' } });
  }
  return { wert };
}

async function medienKopieren(env: InternEnv, von: string, bereich: 'termine' | 'kursleitungen', kennung: string): Promise<string | null> {
  if (!env.MEDIEN) return null;
  const wert = `medien/${bereich}/${kennung.slice(0, 80)}-${zufall()}`;
  for (const g of ['gross', 'klein'] as const) {
    const o = await env.MEDIEN.get(`${von}/${g}`);
    if (!o) return null;
    await env.MEDIEN.put(`${wert}/${g}`, o.body, { httpMetadata: o.httpMetadata });
  }
  return wert;
}

// Bildwert einer Termin- oder Kursleitungsdatei
function bildwertAus(pfad: string, inhalt: string | null): string | null {
  if (!inhalt) return null;
  try {
    if (pfad.endsWith('.json')) return (JSON.parse(inhalt).foto as string) ?? null;
    return (lesen(inhalt).daten.bild as string) ?? null;
  } catch { return null; }
}

// ---------- Prüfung Termin ----------
type NeueLeitung = { schluessel: string; id: string; json: Record<string, unknown>; foto: any };

function pruefeLeitungFelder(f: any, fehlerListe: Record<string, string>, praefix: string, neu: boolean) {
  const name = txt(f?.name, L.nameMax);
  if (name.length < L.nameMin || name.length > L.nameMax) fehlerListe[praefix + 'name'] = `Name: ${L.nameMin}–${L.nameMax} Zeichen`;
  const vorstellung = txt(f?.vorstellung, L.vorstellungMax);
  if (vorstellung.length > L.vorstellungMax) fehlerListe[praefix + 'vorstellung'] = `Kurzvorstellung: höchstens ${L.vorstellungMax} Zeichen`;
  const mail = txt(f?.mail, 120);
  if (mail && !EMAIL.test(mail)) fehlerListe[praefix + 'mail'] = 'Mailadresse prüfen';
  const foto_nachweis = txt(f?.foto_nachweis, T.nachweisMax);
  if (foto_nachweis.length > T.nachweisMax) fehlerListe[praefix + 'foto_nachweis'] = `Bildrechte: höchstens ${T.nachweisMax} Zeichen`;
  if (neu && f?.einwilligung !== true) fehlerListe[praefix + 'einwilligung'] = 'Einwilligung der Kursleitung muss vorliegen';
  return { name, vorstellung: vorstellung || undefined, mail: mail || undefined, foto_alt: name, foto_nachweis: foto_nachweis || undefined };
}

function pruefeTermin(f: any, stand: Stand, neueNamen: Map<string, string>) {
  const e: Record<string, string> = {};
  const titel = txt(f.titel, T.titelMax);
  if (titel.length < T.titelMin || titel.length > T.titelMax) e.titel = `Titel: ${T.titelMin}–${T.titelMax} Zeichen`;
  const beginn = String(f.beginn ?? '');
  const ende = String(f.ende || f.beginn || '');
  if (!DATUM_ISO.test(beginn)) e.beginn = 'Datum (von) fehlt';
  if (!DATUM_ISO.test(ende)) e.ende = 'Datum (bis) prüfen';
  else if (ende < beginn) e.ende = 'Datum (bis) liegt vor Datum (von)';
  const mehrtaegig = DATUM_ISO.test(beginn) && DATUM_ISO.test(ende) && naechte(beginn, ende) > 0;
  const ub = String(f.uhrzeit_beginn ?? ''), ue = String(f.uhrzeit_ende ?? '');
  if (!UHRZEIT.test(ub)) e.uhrzeit_beginn = mehrtaegig ? 'Anreise (Uhrzeit) fehlt' : 'Beginn (Uhrzeit) fehlt';
  if (!UHRZEIT.test(ue)) e.uhrzeit_ende = mehrtaegig ? 'Abreise (Uhrzeit) fehlt' : 'Ende (Uhrzeit) fehlt';
  else if (!mehrtaegig && UHRZEIT.test(ub) && ue <= ub) e.uhrzeit_ende = 'Ende liegt vor Beginn';

  const vorhandene = new Map(stand.kursleitungen.map((l) => [l.id, l.daten]));
  const leitung: string[] = Array.isArray(f.leitung) ? [...new Set(f.leitung.map(String))] as string[] : [];
  if (leitung.length < 1) e.leitung = 'Mindestens eine Kursleitung auswählen';
  else if (leitung.length > T.leitungMax) e.leitung = `Höchstens ${T.leitungMax} Kursleitungen`;
  else if (leitung.some((id) => !vorhandene.has(id) && !neueNamen.has(id))) e.leitung = 'Unbekannte Kursleitung';

  const eigener_termin = f.eigener_termin === true;
  const anmeldung_web = txt(f.anmeldung_web, 300);
  if (anmeldung_web && !/^https?:\/\/[^\s.]+\.[^\s]+$/.test(anmeldung_web)) e.anmeldung_web = 'Website-Adresse prüfen (mit https://)';
  if (!eigener_termin && !anmeldung_web) {
    const mitMail = leitung.some((id) => vorhandene.get(id)?.mail || neueNamen.get(id) === 'mail');
    if (!mitMail) e.leitung = 'Externer Termin: Die Kursleitung braucht eine Mailadresse (oder Website zum Kurs angeben)';
  }

  const kurzbeschreibung = txt(f.kurzbeschreibung, T.kurzbeschreibungMax).replace(/\s+/g, ' ');
  if (!kurzbeschreibung) e.kurzbeschreibung = 'Kurzbeschreibung fehlt';
  else if (kurzbeschreibung.length > T.kurzbeschreibungMax) e.kurzbeschreibung = `Kurzbeschreibung: höchstens ${T.kurzbeschreibungMax} Zeichen`;
  const beschreibung = typeof f.beschreibung === 'string' ? f.beschreibung : '';
  if (beschreibung.length > T.beschreibungMax) e.beschreibung = `Beschreibung: höchstens ${T.beschreibungMax} Zeichen`;

  const bild_alt = txt(f.bild_alt, T.bildAltMax);
  if (!bild_alt || bild_alt.length > T.bildAltMax) e.bild_alt = 'Bildbeschreibung fehlt (für Menschen, die das Bild nicht sehen)';
  const bild_nachweis = txt(f.bild_nachweis, T.nachweisMax);
  if (bild_nachweis.length > T.nachweisMax) e.bild_nachweis = `Bildrechte: höchstens ${T.nachweisMax} Zeichen`;

  const uebernachtung = f.uebernachtung === true;
  const verpflegung = String(f.verpflegung ?? '');
  if (!(VERPFLEGUNG_WERTE as string[]).includes(verpflegung)) e.verpflegung = 'Verpflegung auswählen';
  const preis_ab = zahl(f.preis_ab);
  if (preis_ab !== undefined && (Number.isNaN(preis_ab) || preis_ab < 0 || preis_ab > T.preisMax)) e.preis_ab = 'Preis prüfen';
  else if (preis_ab === undefined && (uebernachtung || verpflegung !== 'keine')) e.preis_ab = 'Preis für Übernachtung und Verpflegung fehlt';
  const kursgebuehr = zahl(f.kursgebuehr);
  if (kursgebuehr !== undefined && (Number.isNaN(kursgebuehr) || kursgebuehr < 0 || kursgebuehr > T.preisMax)) e.kursgebuehr = 'Kursgebühr prüfen';
  const ust = f.ust === '' || f.ust === undefined || f.ust === null ? undefined : Number(f.ust);
  if (kursgebuehr !== undefined && !(UST_WERTE as readonly number[]).includes(ust as number)) e.ust = 'Umsatzsteuer auswählen';

  return {
    fehler: e,
    daten: {
      titel, leitung, beginn, ende, uhrzeit_beginn: ub, uhrzeit_ende: ue, eigener_termin,
      anmeldung_web: anmeldung_web || undefined, kurzbeschreibung, bild_alt, bild_nachweis: bild_nachweis || undefined,
      uebernachtung, verpflegung, preis_ab, kursgebuehr, ust: kursgebuehr !== undefined ? ust : undefined,
    } as Record<string, Wert | undefined>,
    text: beschreibungMarkdown(beschreibung),
  };
}

// Commit und Pull Request als ein Schritt. Scheitert etwas und der Branch ist neu,
// wird er wieder entfernt, damit kein halber Entwurf (Branch ohne PR) zurückbleibt.
class EntwurfFehler extends Error {}
async function entwurfSchreiben(gh: Github, branch: string, nachricht: string, dateien: Datei[], titel: string, text: string): Promise<number> {
  const neu = !(await gh.branchSha(branch));
  try {
    await gh.commit(branch, 'main', nachricht, dateien);
    return await gh.prAnlegenOderAktualisieren(branch, titel, text);
  } catch (e) {
    if (neu) await gh.api('Branch entfernen', `/git/refs/heads/${branch}`, { method: 'DELETE' }).catch(() => {});
    const schritt = e instanceof GithubFehler ? `${e.schritt} (${e.status})` : 'unbekannt';
    throw new EntwurfFehler(`Nicht gespeichert, nichts wurde geändert. GitHub: ${schritt} fehlgeschlagen.${e instanceof GithubFehler && e.status === 403 ? ' Vermutlich fehlt dem Token eine Berechtigung.' : ''} Bitte Matthias Bescheid geben.`);
  }
}

// ---------- Aktionen ----------
async function terminSpeichern(request: Request, env: InternEnv, gh: Github): Promise<Response> {
  const b: any = await request.json().catch(() => null);
  if (!b || typeof b !== 'object') return fehler(400, 'invalid_json');
  const modus: 'neu' | 'bearbeiten' | 'kopie' = ['neu', 'bearbeiten', 'kopie'].includes(b.modus) ? b.modus : 'neu';
  const stand = await standMain(request, env);

  // Neue Kursleitungen im selben Entwurf
  const fe: Record<string, string> = {};
  const neueNamen = new Map<string, string>();
  const neue: NeueLeitung[] = [];
  const belegt = new Set(stand.kursleitungen.map((l) => l.id));
  const namenVorhanden = new Set(stand.kursleitungen.map((l) => String(l.daten.name).toLowerCase()));
  (Array.isArray(b.neueLeitungen) ? b.neueLeitungen : []).slice(0, T.leitungMax).forEach((nl: any, i: number) => {
    const j = pruefeLeitungFelder(nl, fe, `neu${i}_`, true);
    if (namenVorhanden.has(j.name.toLowerCase())) fe[`neu${i}_name`] = 'Diese Kursleitung gibt es schon, bitte auswählen';
    let id = kurzname(j.name, NAME_KURZ);
    for (let n = 2; belegt.has(id); n++) id = `${kurzname(j.name, NAME_KURZ - 3)}-${n}`;
    belegt.add(id);
    const schluessel = `neu:${i}`;
    neueNamen.set(schluessel, j.mail ? 'mail' : '');
    neue.push({ schluessel, id, json: j, foto: nl?.foto });
    if (!nl?.foto?.gross) fe[`neu${i}_foto`] = 'Foto fehlt';
  });

  // Beim Bearbeiten eines Entwurfs: dort angelegte Kursleitungen (noch nicht auf main) mitzählen
  const entwurfsLeitungen: string[] = [];
  if (modus === 'bearbeiten' && /^[a-z0-9-]{3,80}$/.test(String(b.id ?? '')) && (await gh.branchSha(`termin/${b.id}`))) {
    const gewuenscht = Array.isArray(b.felder?.leitung) ? b.felder.leitung.map(String) : [];
    const bisherRoh = await gh.text(`${TERMINE}/${b.id}.md`, `termin/${b.id}`);
    const bisherLeitung = bisherRoh ? ((lesen(bisherRoh).daten.leitung as string[]) ?? []) : [];
    for (const lid of new Set<string>([...gewuenscht, ...bisherLeitung])) {
      if (!/^[a-z0-9-]{2,80}$/.test(lid) || stand.kursleitungen.some((l) => l.id === lid)) continue;
      const roh = await gh.text(`${LEITUNGEN}/${lid}.json`, `termin/${b.id}`);
      if (roh) { stand.kursleitungen.push({ id: lid, daten: JSON.parse(roh) }); entwurfsLeitungen.push(lid); }
    }
  }

  const p = pruefeTermin(b.felder ?? {}, stand, neueNamen);
  Object.assign(p.fehler, fe);

  // Kennung und aktueller Stand
  let id: string;
  let bisher: Record<string, Wert> | null = null; // Stand auf dem Entwurf oder main
  let bildMain: string | null = null;
  if (modus === 'bearbeiten') {
    id = String(b.id ?? '');
    if (!/^[a-z0-9-]{3,80}$/.test(id)) return fehler(400, 'id');
    const branch = `termin/${id}`;
    const ref = (await gh.branchSha(branch)) ? branch : 'main';
    const roh = await gh.text(`${TERMINE}/${id}.md`, ref);
    if (!roh) return fehler(404, 'Termin nicht gefunden');
    bisher = lesen(roh).daten;
    bildMain = bildwertAus('x.md', ref === 'main' ? roh : await gh.text(`${TERMINE}/${id}.md`, 'main'));
  } else {
    if (p.fehler.beginn || p.fehler.titel) return fehler(400, 'invalid', { felder: p.fehler });
    const basis = `${p.daten.beginn}-${kurzname(String(p.daten.titel), TITEL_KURZ)}`;
    id = basis;
    const ids = new Set(stand.termine.map((t) => t.id));
    for (let n = 2; ids.has(id) || (await gh.branchSha(`termin/${id}`)); n++) {
      if (n > 9) return fehler(409, 'Kennung nicht frei');
      id = `${basis}-${n}`;
    }
  }

  // Bild
  const bild = b.bild ?? { art: 'behalten' };
  let bildWert: string | null = null;
  if (bild.art === 'hausbild') {
    if (!HAUSBILD_NAMEN.includes(String(bild.wert).replace(/^haus\//, ''))) p.fehler.bild = 'Hausbild auswählen';
    else bildWert = 'haus/' + String(bild.wert).replace(/^haus\//, '');
  } else if (bild.art === 'behalten') {
    if (!bisher || typeof bisher.bild !== 'string') p.fehler.bild = 'Kursbild fehlt';
    else bildWert = bisher.bild;
  } else if (bild.art === 'kopie') {
    const quelle = stand.termine.find((t) => t.id === String(b.von ?? ''));
    if (!quelle || typeof quelle.daten.bild !== 'string') p.fehler.bild = 'Kursbild der Vorlage nicht gefunden, bitte neu wählen';
    else bildWert = quelle.daten.bild; // wird unten kopiert
  } else if (bild.art !== 'neu') p.fehler.bild = 'Kursbild fehlt';

  if (Object.keys(p.fehler).length) return fehler(400, 'invalid', { felder: p.fehler });

  // Ab hier: Bilder ablegen, dann ein Commit
  const angelegt: string[] = [];
  try {
    if (bild.art === 'neu') {
      const r = await medienAblegen(env, 'termine', id, bild);
      if (r.fehler) return fehler(400, 'invalid', { felder: { bild: r.fehler } });
      bildWert = r.wert!;
      angelegt.push(bildWert);
    } else if (bild.art === 'kopie' && istMedien(bildWert)) {
      const k = await medienKopieren(env, bildWert, 'termine', id);
      if (!k) return fehler(400, 'invalid', { felder: { bild: 'Kursbild der Vorlage nicht gefunden, bitte neu wählen' } });
      bildWert = k;
      angelegt.push(k);
    }
    const dateien: Datei[] = [];
    const leitungIds = (p.daten.leitung as string[]).map((s) => neue.find((n) => n.schluessel === s)?.id ?? s);
    for (const n of neue) {
      if (!leitungIds.includes(n.id)) continue; // angelegt, aber nicht ausgewählt: nicht speichern
      const r = await medienAblegen(env, 'kursleitungen', n.id, n.foto);
      if (r.fehler) { await medienLoeschen(env, angelegt); return fehler(400, 'invalid', { felder: { [`neu${n.schluessel.slice(4)}_foto`]: r.fehler } }); }
      angelegt.push(r.wert!);
      dateien.push({ pfad: `${LEITUNGEN}/${n.id}.json`, text: JSON.stringify({ ...n.json, foto: r.wert }, null, 2) + '\n' });
    }
    p.daten.leitung = leitungIds;
    // Im Entwurf angelegte, jetzt abgewählte Kursleitungen wieder entfernen (samt Foto)
    const verwaist: string[] = [];
    for (const lid of entwurfsLeitungen) {
      if (leitungIds.includes(lid)) continue;
      dateien.push({ pfad: `${LEITUNGEN}/${lid}.json`, loeschen: true });
      const f = stand.kursleitungen.find((l) => l.id === lid)?.daten.foto;
      if (istMedien(f)) verwaist.push(f);
    }
    p.daten.bild = bildWert;
    // Eigene Felder, die das Formular nicht kennt, bleiben erhalten
    const zusatz = bisher ? Object.fromEntries(Object.entries(bisher).filter(([k]) => !(k in p.daten))) : {};
    dateien.push({ pfad: `${TERMINE}/${id}.md`, text: schreiben({ ...p.daten, ...zusatz }, p.text) });

    const branch = `termin/${id}`;
    const titel = `Termin: ${p.daten.titel} (${datumDE(String(p.daten.beginn))})`;
    const bildVorher = bisher && typeof bisher.bild === 'string' ? bisher.bild : null;
    const pr = await entwurfSchreiben(gh, branch, `${titel}\n\n${modus === 'bearbeiten' ? 'Geändert' : 'Angelegt'} über das Termin-Formular.`, dateien, titel, 'Angelegt über das Termin-Formular (/intern/termin/). Vorschau: siehe Prüfung „Workers Builds“. Veröffentlichen über das Formular.');
    // Bild eines früheren Entwurfsstands, das weder live noch neu ist, gleich entfernen
    if (bildVorher && bildVorher !== bildWert && bildVorher !== bildMain) await medienLoeschen(env, [bildVorher]);
    await medienLoeschen(env, verwaist);
    return json({ status: 'ok', id, pr, branch });
  } catch (e) {
    await medienLoeschen(env, angelegt).catch(() => {});
    throw e;
  }
}

async function terminLoeschen(request: Request, env: InternEnv, gh: Github): Promise<Response> {
  const b: any = await request.json().catch(() => null);
  const id = String(b?.id ?? '');
  if (!/^[a-z0-9-]{3,80}$/.test(id)) return fehler(400, 'id');
  const roh = await gh.text(`${TERMINE}/${id}.md`, 'main');
  if (!roh) return fehler(404, 'Termin ist nicht veröffentlicht. Entwürfe bitte verwerfen.');
  const d = lesen(roh).daten;
  const branch = `termin/${id}`;
  const titel = `Termin löschen: ${d.titel} (${datumDE(String(d.beginn))})`;
  const pr = await entwurfSchreiben(gh, branch, `${titel}\n\nGelöscht über das Termin-Formular.`, [{ pfad: `${TERMINE}/${id}.md`, loeschen: true }], titel, 'Löschen über das Termin-Formular. Das Kursbild wird beim Veröffentlichen aus dem Bildspeicher entfernt.');
  return json({ status: 'ok', id, pr, branch });
}

async function leitungSpeichern(request: Request, env: InternEnv, gh: Github): Promise<Response> {
  const b: any = await request.json().catch(() => null);
  if (!b) return fehler(400, 'invalid_json');
  const stand = await standMain(request, env);
  const fe: Record<string, string> = {};
  const neu = !b.id;
  const j = pruefeLeitungFelder(b.felder ?? {}, fe, '', neu);
  let id = String(b.id ?? '');
  let bisher: Record<string, any> | null = null;
  let fotoMain: string | null = null;
  if (neu) {
    if (stand.kursleitungen.some((l) => String(l.daten.name).toLowerCase() === j.name.toLowerCase())) fe.name = 'Diese Kursleitung gibt es schon';
    id = kurzname(j.name, NAME_KURZ);
    for (let n = 2; stand.kursleitungen.some((l) => l.id === id) || (await gh.branchSha(`kursleitung/${id}`)); n++) id = `${kurzname(j.name, NAME_KURZ - 3)}-${n}`;
  } else {
    if (!/^[a-z0-9-]{2,80}$/.test(id)) return fehler(400, 'id');
    const branch = `kursleitung/${id}`;
    const ref = (await gh.branchSha(branch)) ? branch : 'main';
    const roh = await gh.text(`${LEITUNGEN}/${id}.json`, ref);
    if (!roh) return fehler(404, 'Kursleitung nicht gefunden');
    bisher = JSON.parse(roh);
    fotoMain = bildwertAus('x.json', ref === 'main' ? roh : await gh.text(`${LEITUNGEN}/${id}.json`, 'main'));
    if (stand.kursleitungen.some((l) => l.id !== id && String(l.daten.name).toLowerCase() === j.name.toLowerCase())) fe.name = 'Diesen Namen hat schon eine andere Kursleitung';
  }
  if (!b.foto?.gross && !bisher?.foto) fe.foto = 'Foto fehlt';
  if (Object.keys(fe).length) return fehler(400, 'invalid', { felder: fe });

  let foto = bisher?.foto as string | undefined;
  let angelegt: string | null = null;
  if (b.foto?.gross) {
    const r = await medienAblegen(env, 'kursleitungen', id, b.foto);
    if (r.fehler) return fehler(400, 'invalid', { felder: { foto: r.fehler } });
    foto = angelegt = r.wert!;
  }
  try {
    const inhalt = { ...(bisher ?? {}), ...j, foto };
    for (const k of Object.keys(inhalt)) if ((inhalt as any)[k] === undefined) delete (inhalt as any)[k];
    const branch = `kursleitung/${id}`;
    const titel = `Kursleitung: ${j.name}`;
    const pr = await entwurfSchreiben(gh, branch, `${titel}\n\n${neu ? 'Angelegt' : 'Geändert'} über das Termin-Formular.`, [{ pfad: `${LEITUNGEN}/${id}.json`, text: JSON.stringify(inhalt, null, 2) + '\n' }], titel, 'Über das Termin-Formular (/intern/termin/).');
    const vorher = bisher?.foto as string | undefined;
    if (angelegt && vorher && vorher !== fotoMain) await medienLoeschen(env, [vorher]);
    return json({ status: 'ok', id, pr, branch });
  } catch (e) {
    if (angelegt) await medienLoeschen(env, [angelegt]).catch(() => {});
    throw e;
  }
}

async function leitungLoeschen(request: Request, env: InternEnv, gh: Github): Promise<Response> {
  const b: any = await request.json().catch(() => null);
  const id = String(b?.id ?? '');
  if (!/^[a-z0-9-]{2,80}$/.test(id)) return fehler(400, 'id');
  const stand = await standMain(request, env);
  const nutzer = stand.termine.filter((t) => Array.isArray(t.daten.leitung) && (t.daten.leitung as string[]).includes(id));
  if (nutzer.length) return fehler(409, 'Kursleitung wird noch genutzt', { termine: nutzer.map((t) => t.daten.titel) });
  const roh = await gh.text(`${LEITUNGEN}/${id}.json`, 'main');
  if (!roh) return fehler(404, 'Kursleitung ist nicht veröffentlicht. Entwürfe bitte verwerfen.');
  const name = JSON.parse(roh).name;
  const branch = `kursleitung/${id}`;
  const titel = `Kursleitung löschen: ${name}`;
  const pr = await entwurfSchreiben(gh, branch, `${titel}\n\nGelöscht über das Termin-Formular.`, [{ pfad: `${LEITUNGEN}/${id}.json`, loeschen: true }], titel, 'Löschen über das Termin-Formular.');
  return json({ status: 'ok', id, pr, branch });
}

// Vorschau-Link aus der Prüfung von Workers Builds (Check-Run) oder einem Kommentar am PR
function vorschauAus(text: string, produktiv: string): string | null {
  const urls = text.match(/https:\/\/[a-z0-9.-]+\.workers\.dev[^\s)"'<>\]|]*/gi) ?? [];
  const passend = urls.map((u) => u.replace(/[.,;]+$/, '')).filter((u) => new URL(u).host !== produktiv);
  return passend[0] ? new URL(passend[0]).origin : null;
}

async function status(request: Request, gh: Github, vorschauHost: string): Promise<Response> {
  const n = Number(new URL(request.url).searchParams.get('pr'));
  if (!Number.isInteger(n) || n < 1) return fehler(400, 'pr');
  const pr = await gh.api<any>('PR lesen', `/pulls/${n}`);
  if (!/^(termin|kursleitung)\//.test(pr.head.ref)) return fehler(403, 'Kein Entwurf des Termin-Formulars');
  const runs = await gh.api<any>('Prüfung lesen', `/commits/${pr.head.sha}/check-runs?per_page=50`);
  const lauf = (runs.check_runs ?? []).find((r: any) => /workers builds/i.test(r.name));
  let pruefung: 'wartet' | 'laeuft' | 'gruen' | 'rot' = 'wartet';
  if (lauf) pruefung = lauf.status !== 'completed' ? 'laeuft' : lauf.conclusion === 'success' ? 'gruen' : 'rot';
  const produktiv = new URL(request.url).host;
  let vorschau = lauf ? vorschauAus(`${lauf.output?.summary ?? ''}\n${lauf.output?.text ?? ''}\n${lauf.details_url ?? ''}`, produktiv) : null;
  if (!vorschau && pruefung === 'gruen') {
    const k = await gh.api<any[]>('Kommentare lesen', `/issues/${n}/comments?per_page=30`);
    vorschau = vorschauAus(k.map((c) => c.body).join('\n'), produktiv);
  }
  // Ohne Kommentar (z. B. Build lief vor dem PR): Adresse nach dem Muster von Workers Builds
  // <branch, Sonderzeichen als ->-<worker>.<konto>.workers.dev bilden
  if (!vorschau && pruefung === 'gruen' && vorschauHost) vorschau = `https://${pr.head.ref.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${vorschauHost}`;
  return json({
    status: 'ok', pr: n, titel: pr.title, branch: pr.head.ref,
    zustand: pr.merged ? 'veroeffentlicht' : pr.state === 'closed' ? 'verworfen' : 'entwurf',
    pruefung, vorschau, pruefungLink: lauf?.details_url ?? pr.html_url,
  });
}

async function prDateienWerte(gh: Github, n: number, branchRef: string) {
  const dateien = await gh.api<any[]>('Dateien des Entwurfs', `/pulls/${n}/files?per_page=50`);
  const werte: { alt: string | null; neu: string | null }[] = [];
  for (const d of dateien) {
    const pfad: string = d.filename;
    if (!(pfad.startsWith(TERMINE + '/') || pfad.startsWith(LEITUNGEN + '/'))) continue;
    const alt = d.status === 'added' ? null : bildwertAus(pfad, await gh.text(pfad, 'main'));
    const neu = d.status === 'removed' ? null : bildwertAus(pfad, await gh.text(pfad, branchRef));
    werte.push({ alt, neu });
  }
  return werte;
}

async function veroeffentlichen(request: Request, env: InternEnv, gh: Github): Promise<Response> {
  const b: any = await request.json().catch(() => null);
  const n = Number(b?.pr);
  if (!Number.isInteger(n) || n < 1) return fehler(400, 'pr');
  const pr = await gh.api<any>('PR lesen', `/pulls/${n}`);
  if (!/^(termin|kursleitung)\//.test(pr.head.ref) || pr.state !== 'open') return fehler(409, 'Entwurf ist nicht mehr offen');
  const runs = await gh.api<any>('Prüfung lesen', `/commits/${pr.head.sha}/check-runs?per_page=50`);
  const lauf = (runs.check_runs ?? []).find((r: any) => /workers builds/i.test(r.name));
  if (!lauf || lauf.status !== 'completed' || lauf.conclusion !== 'success') return fehler(409, 'Die Prüfung ist noch nicht grün');
  const werte = await prDateienWerte(gh, n, pr.head.sha);
  try {
    await gh.api('Veröffentlichen', `/pulls/${n}/merge`, { method: 'PUT', body: { merge_method: 'squash', sha: pr.head.sha, commit_title: `${pr.title} (#${n})` } });
  } catch (e) {
    if (e instanceof GithubFehler && [405, 409, 422].includes(e.status)) return fehler(409, 'Veröffentlichen nicht möglich (Prüfung, Konflikt oder Regel). Bitte Matthias Bescheid geben.');
    throw e;
  }
  // Bilder, die nur der alte Stand nutzte, aus R2 entfernen
  await medienLoeschen(env, werte.filter((w) => w.alt && w.alt !== w.neu).map((w) => w.alt));
  return json({ status: 'ok' });
}

async function verwerfen(request: Request, env: InternEnv, gh: Github): Promise<Response> {
  const b: any = await request.json().catch(() => null);
  const n = Number(b?.pr);
  if (!Number.isInteger(n) || n < 1) return fehler(400, 'pr');
  const pr = await gh.api<any>('PR lesen', `/pulls/${n}`);
  if (!/^(termin|kursleitung)\//.test(pr.head.ref) || pr.state !== 'open') return fehler(409, 'Entwurf ist nicht mehr offen');
  const werte = await prDateienWerte(gh, n, pr.head.sha);
  await gh.api('Entwurf schließen', `/pulls/${n}`, { method: 'PATCH', body: { state: 'closed' } });
  await gh.api('Branch löschen', `/git/refs/heads/${pr.head.ref}`, { method: 'DELETE' }).catch(() => {});
  // Bilder, die nur der Entwurf nutzte, aus R2 entfernen
  await medienLoeschen(env, werte.filter((w) => w.neu && w.neu !== w.alt).map((w) => w.neu));
  return json({ status: 'ok' });
}

async function eintragLesen(request: Request, gh: Github, art: 'termin' | 'kursleitung'): Promise<Response> {
  const id = new URL(request.url).searchParams.get('id') ?? '';
  if (!/^[a-z0-9-]{2,80}$/.test(id)) return fehler(400, 'id');
  const branch = `${art}/${id}`;
  const ref = (await gh.branchSha(branch)) ? branch : 'main';
  const pfad = art === 'termin' ? `${TERMINE}/${id}.md` : `${LEITUNGEN}/${id}.json`;
  const roh = await gh.text(pfad, ref);
  if (!roh) return fehler(404, ref === 'main' ? 'nicht gefunden' : 'Im Entwurf gelöscht');
  const pr = ref === 'main' ? null : await gh.offenerPr(branch);
  if (art === 'kursleitung') return json({ status: 'ok', id, quelle: ref === 'main' ? 'main' : 'entwurf', pr: pr?.number ?? null, daten: JSON.parse(roh) });
  const { daten, text } = lesen(roh);
  const leitungenEntwurf: { id: string; daten: unknown }[] = [];
  if (ref !== 'main') {
    for (const lid of (Array.isArray(daten.leitung) ? daten.leitung : []) as string[]) {
      if (await gh.text(`${LEITUNGEN}/${lid}.json`, 'main')) continue;
      const l = await gh.text(`${LEITUNGEN}/${lid}.json`, ref);
      if (l) leitungenEntwurf.push({ id: lid, daten: JSON.parse(l) });
    }
  }
  return json({ status: 'ok', id, quelle: ref === 'main' ? 'main' : 'entwurf', pr: pr?.number ?? null, daten, beschreibung: beschreibungText(text), leitungenEntwurf });
}

async function standLesen(request: Request, env: InternEnv, gh: Github): Promise<Response> {
  const daten = await standMain(request, env);
  const prs = await gh.api<any[]>('Entwürfe lesen', '/pulls?state=open&per_page=100');
  const entwuerfe = prs
    .filter((p) => /^(termin|kursleitung)\//.test(p.head.ref))
    .map((p) => ({ pr: p.number, titel: p.title, branch: p.head.ref, art: p.head.ref.split('/')[0], id: p.head.ref.split('/').slice(1).join('/'), geaendert: p.updated_at }));
  return json({ status: 'ok', ...daten, entwuerfe });
}

// ---------- Einstieg ----------
export async function medien(request: Request, env: InternEnv): Promise<Response> {
  const m = /^\/(medien\/(?:termine|kursleitungen)\/[a-z0-9-]{3,90})\/(gross|klein)$/.exec(new URL(request.url).pathname);
  if (!m || !env.MEDIEN || (request.method !== 'GET' && request.method !== 'HEAD')) return new Response('Nicht gefunden', { status: 404 });
  const o = await env.MEDIEN.get(`${m[1]}/${m[2]}`);
  if (!o) return new Response('Nicht gefunden', { status: 404 });
  const h = new Headers();
  o.writeHttpMetadata(h);
  h.set('etag', o.httpEtag);
  h.set('cache-control', 'public, max-age=31536000, immutable');
  h.set('x-content-type-options', 'nosniff');
  return new Response(request.method === 'HEAD' ? null : o.body, { headers: h });
}

export async function intern(request: Request, env: InternEnv): Promise<Response> {
  const url = new URL(request.url);
  const mail = await accessMail(request, env).catch(() => null);
  if (!mail) {
    const eingerichtet = env.ACCESS_TEAM && env.ACCESS_AUD && env.INTERN_ERLAUBT;
    return url.pathname.startsWith('/api/')
      ? fehler(eingerichtet ? 403 : 503, eingerichtet ? 'Kein Zugang' : 'Zugang nicht eingerichtet')
      : new Response(eingerichtet ? 'Kein Zugang.' : 'Zugang nicht eingerichtet.', { status: eingerichtet ? 403 : 503, headers: { 'content-type': 'text/plain; charset=utf-8', 'x-robots-tag': 'noindex' } });
  }
  if (!url.pathname.startsWith('/api/')) {
    const r = await env.ASSETS.fetch(request);
    const h = new Headers(r.headers);
    h.set('x-robots-tag', 'noindex, nofollow');
    h.set('cache-control', 'no-store');
    return new Response(r.body, { status: r.status, headers: h });
  }
  if (request.method === 'POST' && request.headers.get('origin') !== url.origin) return fehler(403, 'Herkunft');
  if (!env.GITHUB_TOKEN) return fehler(503, 'GitHub-Zugang nicht eingerichtet');
  const gh = new Github(env.GITHUB_TOKEN, env.GITHUB_REPO || 'sysadmin-selbstgemacht/website');
  try {
    const r = `${request.method} ${url.pathname}`;
    if (r === 'GET /api/intern/stand') return await standLesen(request, env, gh);
    if (r === 'GET /api/intern/termin') return await eintragLesen(request, gh, 'termin');
    if (r === 'GET /api/intern/kursleitung') return await eintragLesen(request, gh, 'kursleitung');
    if (r === 'POST /api/intern/termin') return await terminSpeichern(request, env, gh);
    if (r === 'POST /api/intern/termin/loeschen') return await terminLoeschen(request, env, gh);
    if (r === 'POST /api/intern/kursleitung') return await leitungSpeichern(request, env, gh);
    if (r === 'POST /api/intern/kursleitung/loeschen') return await leitungLoeschen(request, env, gh);
    if (r === 'GET /api/intern/status') return await status(request, gh, env.VORSCHAU_HOST || (url.hostname.endsWith('.workers.dev') ? url.hostname : ''));
    if (r === 'POST /api/intern/veroeffentlichen') return await veroeffentlichen(request, env, gh);
    if (r === 'POST /api/intern/verwerfen') return await verwerfen(request, env, gh);
    return fehler(404, 'not_found');
  } catch (e) {
    console.error('intern', e instanceof GithubFehler ? `${e.schritt}: ${e.status}` : String(e));
    if (e instanceof EntwurfFehler) return fehler(502, e.message);
    if (e instanceof GithubFehler) return fehler(502, `GitHub: ${e.schritt} fehlgeschlagen (${e.status})`);
    if (e instanceof FrontmatterFehler) return fehler(422, `Datei nicht lesbar: ${e.message}. Bitte Matthias Bescheid geben.`);
    return fehler(500, 'Interner Fehler');
  }
}
