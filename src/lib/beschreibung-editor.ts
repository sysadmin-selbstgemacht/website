// Einfacher Editor für „Ausführliche Beschreibung“ im Termin-Formular (Handoff 21.11.):
// contenteditable ohne Bibliothek. Erlaubt: Absatz, Aufzählung, nummerierte Aufzählung, Fett.
// Der Editor tauscht Text im Zwischenformat aus (siehe beschreibungMarkdown in termin-felder.ts):
//   HTML im Editor  ⇄  Zwischenformat (Formularfeld)  ⇄  Markdown (Termin-Datei, im Worker)

const PUNKT = /^\s*[-*•–]\s+(.*)$/;
const NUMMER = /^\s*\d+[.)]\s+(.*)$/;

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const inline = (s: string) => esc(s).replace(/\*\*([^*\n]+?)\*\*/g, '<strong>$1</strong>');

type Block = { art: 'p'; text: string } | { art: 'ul' | 'ol'; punkte: string[] };

function bloeckeHtml(bloecke: Block[]): string {
  return bloecke.map((b) => b.art === 'p'
    ? `<p>${inline(b.text)}</p>`
    : `<${b.art}>${b.punkte.map((p) => `<li>${inline(p)}</li>`).join('')}</${b.art}>`).join('');
}

function zeileEinordnen(bloecke: Block[], zeile: string, absatzJeZeile: boolean, neuerAbsatz: boolean) {
  const woertlich = /^\s*\\/.test(zeile);
  const p = woertlich ? null : PUNKT.exec(zeile);
  const n = woertlich || p ? null : NUMMER.exec(zeile);
  const letzter = bloecke[bloecke.length - 1];
  if (p || n) {
    const art = p ? 'ul' : 'ol';
    const text = (p ?? n)![1].trim();
    if (letzter && letzter.art === art && !neuerAbsatz) letzter.punkte.push(text);
    else bloecke.push({ art, punkte: [text] });
    return;
  }
  const text = (woertlich ? zeile.replace(/^\s*\\/, '') : zeile).trim();
  if (!absatzJeZeile && letzter?.art === 'p' && !neuerAbsatz) letzter.text += ' ' + text;
  else bloecke.push({ art: 'p', text });
}

/** Zwischenformat → Editor-HTML (Laden beim Bearbeiten und Kopieren). */
export function textZuHtml(text: string): string {
  const bloecke: Block[] = [];
  let leer = true;
  for (const zeile of text.replace(/\r\n?/g, '\n').split('\n')) {
    if (!zeile.trim()) { leer = true; continue; }
    // Zeilen ohne Leerzeile dazwischen gehören zum selben Absatz (Markdown-Regel)
    zeileEinordnen(bloecke, zeile, false, leer);
    leer = false;
  }
  return bloecke.length ? bloeckeHtml(bloecke) : '<p><br></p>';
}

/** Eingefügter reiner Text → Editor-HTML. Jede Zeile ein Absatz (Word trennt Absätze mit einem Zeilenumbruch);
 *  Zeilen mit •, -, –, * werden zur Aufzählung, mit 1., 2) zur nummerierten Aufzählung. Fett gibt es beim Einfügen nicht. */
export function einfuegenHtml(text: string): string {
  const bloecke: Block[] = [];
  let leer = true;
  for (const roh of text.replace(/\r\n?/g, '\n').replace(/ /g, ' ').split('\n')) {
    // Word und Outlook kopieren Aufzählungspunkte als „·“ bzw. „o“ (2. Ebene) mit Tabulator, auch ▪ ◦ ●
    const zeile = roh.replace(/^\s*(?:[·▪◦●]|o(?=\t))\s*/, '- ').replace(/\t/g, ' ').replace(/\*\*/g, '');
    if (!zeile.trim()) { leer = true; continue; }
    zeileEinordnen(bloecke, zeile, true, leer);
    leer = false;
  }
  // Absätze, die wörtlich wie Listenpunkte aussehen, gibt es beim Einfügen nicht: alles Erkannte ist Liste.
  return bloeckeHtml(bloecke);
}

/** Editor-DOM → Zwischenformat. Wirkt zugleich als Schranke: nur p, ul/ol/li und strong werden gelesen,
 *  alles andere wird zu Text bzw. Absatz; verschachtelte Listen werden flach. */
export function editorZuText(wurzel: HTMLElement): string {
  const bloecke: Block[] = [];
  let offen: string | null = null; // laufender Absatz aus losem Text auf oberster Ebene

  const inlineText = (k: Node): string => {
    if (k.nodeType === 3) return (k.textContent ?? '').replace(/[\s ]+/g, ' ');
    if (k.nodeType !== 1) return '';
    const el = k as HTMLElement;
    if (el.tagName === 'BR') return '\n';
    const innen = [...el.childNodes].map(inlineText).join('');
    if (el.tagName === 'STRONG' || el.tagName === 'B') {
      const t = innen.replace(/\*\*/g, '');
      if (!t.trim()) return t;
      const vor = /^\s*/.exec(t)![0], nach = /\s*$/.exec(t)![0];
      return t.split('\n').map((teil) => teil.trim() ? `**${teil.trim()}**` : teil).join('\n').replace(/^/, vor).replace(/$/, nach);
    }
    return innen;
  };
  const absatz = (t: string) => {
    for (const teil of t.split('\n')) {
      const s = teil.replace(/\s+/g, ' ').trim();
      if (s) bloecke.push({ art: 'p', text: s });
    }
  };
  const schliessen = () => { if (offen !== null) { absatz(offen); offen = null; } };
  const liste = (el: HTMLElement, art: 'ul' | 'ol') => {
    const punkte: string[] = [];
    const sammeln = (l: HTMLElement) => {
      for (const li of [...l.children] as HTMLElement[]) {
        if (li.tagName !== 'LI') continue;
        const eigen = [...li.childNodes].filter((k) => !(k.nodeType === 1 && /^(UL|OL)$/.test((k as HTMLElement).tagName)));
        const t = eigen.map(inlineText).join('').replace(/\s+/g, ' ').trim();
        if (t) punkte.push(t);
        li.querySelectorAll(':scope > ul, :scope > ol').forEach((u) => sammeln(u as HTMLElement));
      }
    };
    sammeln(el);
    if (punkte.length) bloecke.push({ art, punkte });
  };
  const block = (k: Node) => {
    if (k.nodeType === 1) {
      const el = k as HTMLElement;
      if (el.tagName === 'UL' || el.tagName === 'OL') { schliessen(); liste(el, el.tagName === 'UL' ? 'ul' : 'ol'); return; }
      if (/^(P|DIV|H[1-6]|BLOCKQUOTE|SECTION|ARTICLE|LI|PRE)$/.test(el.tagName)) {
        schliessen();
        // Block mit Listen darin (z. B. <div><ul>): Kinder einzeln behandeln
        if (el.querySelector('ul, ol, p, div')) { [...el.childNodes].forEach(block); schliessen(); return; }
        absatz(inlineText(el));
        return;
      }
    }
    offen = (offen ?? '') + inlineText(k);
  };
  [...wurzel.childNodes].forEach(block);
  schliessen();

  const zeilen: string[] = [];
  for (const b of bloecke) {
    if (zeilen.length) zeilen.push('');
    if (b.art === 'p') zeilen.push((PUNKT.test(b.text) || NUMMER.test(b.text) ? '\\' : '') + b.text);
    else b.punkte.forEach((p, i) => zeilen.push((b.art === 'ul' ? '- ' : `${i + 1}. `) + p));
  }
  return zeilen.join('\n');
}

/** Sichtbarer Textinhalt ohne Formatzeichen (für den Zeichenzähler). */
export function editorTextLaenge(wurzel: HTMLElement): number {
  return (wurzel.textContent ?? '').replace(/ /g, ' ').trim().length;
}

/** Eingefügtes HTML (nur wenn es Listen enthält, z. B. von Websites oder Webmail): Struktur übernehmen,
 *  Formatierung verwerfen. Liefert Editor-HTML. */
export function einfuegenAusHtml(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc.querySelectorAll('script, style, template, noscript, head, img, svg, iframe').forEach((x) => x.remove());
  const text = editorZuText(doc.body).replace(/\*\*/g, '');
  return textZuHtml(text);
}
