// Seitentitel und Beschreibungen für Suchmaschinen und die Vorschau beim Teilen.
// EINE Stelle für alle festen Seiten. Die Sitemap liest diese Liste ebenfalls.
// Neue Seite: hier eintragen, sonst fehlt sie in der Sitemap.
//
// Richtwerte: Titel bis ca. 60 Zeichen, Beschreibung bis ca. 155 Zeichen
// (längere Texte kürzt Google in der Trefferliste). Stand: ENTWURF, Abstimmung mit Katrin und Anne.

export interface Seite {
  pfad: string;
  titel: string; // <title> und Teilen-Titel
  beschreibung: string; // <meta name="description"> und Teilen-Text
  bild?: string; // Teilen-Bild (Pfad in public/ oder absolute URL), Freitag im Sprint
  sitemap?: boolean; // Standard: true
}

export const SEITEN = {
  start: {
    pfad: '/',
    titel: 'SELBSTGEMACHT – Seminar- und Gästehaus in Thüringen',
    beschreibung:
      'Ein Haus, exklusiv für eine Gruppe: Seminar- und Gästehaus in Arnsgrün für Familien, Freundeskreise, Tagungen, Kurse und Retreats. Bis zu 30 Gäste.',
  },
  gruppen: {
    pfad: '/gruppen-und-familien/',
    titel: 'Gruppenhaus für Familien und Freunde · SELBSTGEMACHT',
    beschreibung:
      'Das ganze Haus für Familienfeste, Freundeswochenenden und Gruppenreisen: 10 Zimmer, bis zu 30 Gäste, Küche, Terrassen und Wiese in Arnsgrün.',
  },
  firmen: {
    pfad: '/firmen/',
    titel: 'Tagungshaus für Teams und Workshops · SELBSTGEMACHT',
    beschreibung:
      'Ungestört tagen im eigenen Haus: Seminarraum mit Technik, Verpflegung, Rahmenprogramm mit Lamas und Wald. Für Teams, Workshops und Seminare in Thüringen.',
  },
  kursleitende: {
    pfad: '/kursleitende/',
    titel: 'Seminarhaus für Kurse und Retreats · SELBSTGEMACHT',
    beschreibung:
      'Das ganze Haus für Kurs oder Retreat: Seminarraum, Unterkunft und Verpflegung für die Gruppe. Auf Wunsch veröffentlichen wir den Kurs auf unserer Seite.',
  },
  termine: {
    pfad: '/termine/',
    titel: 'Kurse, Retreats und Veranstaltungen · SELBSTGEMACHT',
    beschreibung:
      'Termine im Seminar- und Gästehaus SELBSTGEMACHT: Kurse, Retreats und Veranstaltungen der nächsten zwölf Monate in Arnsgrün, Thüringen.',
  },
  ueberUns: {
    pfad: '/ueber-uns/',
    titel: 'Über uns: Gastgeberinnen und Haus · SELBSTGEMACHT',
    beschreibung:
      'Wer hinter SELBSTGEMACHT steht: Katrin und Anne, ein ehemaliger Konsum als Gästehaus, Lamas und Bienen – und was Gastgeber sein für uns heißt.',
  },
  impressum: {
    pfad: '/impressum/',
    titel: 'Impressum · SELBSTGEMACHT',
    beschreibung: 'Impressum des Seminar- und Gästehauses SELBSTGEMACHT, Arnsgrün 56, Zeulenroda-Triebes.',
  },
  datenschutz: {
    pfad: '/datenschutz/',
    titel: 'Datenschutz · SELBSTGEMACHT',
    beschreibung: 'Datenschutzerklärung der Website von SELBSTGEMACHT: keine Cookies, kein Tracking, Anfragen nur per Formular oder E-Mail.',
  },
  nichtGefunden: {
    pfad: '/404',
    titel: 'Seite nicht gefunden · SELBSTGEMACHT',
    beschreibung: 'Diese Seite gibt es nicht (mehr).',
    sitemap: false,
  },
} satisfies Record<string, Seite>;

export type SeitenSchluessel = keyof typeof SEITEN;
