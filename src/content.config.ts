import { defineCollection, reference } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { GRENZEN_TERMIN as T, GRENZEN_LEITUNG as L, VERPFLEGUNG_WERTE, UST_WERTE, UHRZEIT, BILDWERT, HAUSBILD_NAMEN } from './lib/termin-felder';

// Schemas für Termine und Kursleitungen (Option A, Termin-Formular).
// Ein Eintrag, der nicht passt, lässt den Build scheitern und geht nicht live.
// Feste Werte und Grenzen: src/lib/termin-felder.ts. Felder: docs/termine.md.

// Bildfelder: Schlüssel in R2 ("medien/…") oder Hausbild ("haus/…"), siehe src/lib/termin-felder.ts.
const bildwert = z
  .string()
  .regex(BILDWERT, 'Bild: "medien/…" oder "haus/…"')
  .refine((b) => !b.startsWith('haus/') || HAUSBILD_NAMEN.includes(b.slice(5)), { message: 'unbekanntes Hausbild' });

// Kursleitungen: eine JSON-Datei je Person in src/content/kursleitungen/.
// Der Dateiname (ohne .json) ist die Kennung, auf die Termine verweisen.
const kursleitungen = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/kursleitungen' }),
  schema: () =>
    z.object({
      name: z.string().min(L.nameMin).max(L.nameMax), // feste Schreibweise
      vorstellung: z.string().max(L.vorstellungMax).optional(),
      mail: z.string().email().optional(), // für Anfragen bei externen Terminen
      website: z.string().url().optional(), // erscheint auf der Terminseite als „Website der Kursleitung“
      foto: bildwert, // 16:9, prüft der Worker beim Hochladen
      foto_alt: z.string().max(T.bildAltMax),
      foto_nachweis: z.string().max(T.nachweisMax).optional(), // erscheint dezent unter dem Foto
    }),
});

const termine = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/termine' }),
  schema: () =>
    z
      .object({
        titel: z.string().min(T.titelMin).max(T.titelMax),
        leitung: z.array(reference('kursleitungen')).min(1).max(T.leitungMax),
        beginn: z.coerce.date(),
        ende: z.coerce.date(),
        // eintägig: Beginn und Ende; mehrtägig: Anreise und Abreise
        uhrzeit_beginn: z.string().regex(UHRZEIT, 'Uhrzeit als HH:MM'),
        uhrzeit_ende: z.string().regex(UHRZEIT, 'Uhrzeit als HH:MM'),
        eigener_termin: z.boolean(), // true: Anfrage ans Haus; false: Mail an die Kursleitung
        anmeldung_web: z.string().url().optional(), // optional: Website der Kursleitung zum Termin
        // Kurzbeschreibung: Terminliste, Google und Teilen
        kurzbeschreibung: z.string().min(1).max(T.kurzbeschreibungMax),
        // Kursbild 16:9 in R2 oder Hausbild
        bild: bildwert,
        bild_alt: z.string().min(1).max(T.bildAltMax),
        bild_nachweis: z.string().max(T.nachweisMax).optional(), // erscheint dezent unter dem Bild
        uebernachtung: z.boolean(),
        verpflegung: z.enum(VERPFLEGUNG_WERTE),
        // Übernachtung und Verpflegung ab … € pro Person für den gesamten Aufenthalt
        preis_ab: z.number().min(0).max(T.preisMax).optional(),
        kursgebuehr: z.number().min(0).max(T.preisMax).optional(),
        ust: z.union(UST_WERTE.map((u) => z.literal(u)) as [z.ZodLiteral<0>, z.ZodLiteral<7>, z.ZodLiteral<19>]).optional(),
      })
      .refine((t) => t.ende >= t.beginn, { message: 'ende liegt vor beginn' })
      .refine((t) => t.kursgebuehr === undefined || t.ust !== undefined, { message: 'kursgebuehr braucht ust (0, 7 oder 19)' })
      .refine((t) => t.preis_ab !== undefined || (!t.uebernachtung && t.verpflegung === 'keine'), {
        message: 'preis_ab fehlt (nur ohne Übernachtung und ohne Verpflegung entbehrlich)',
      }),
});

export const collections = { kursleitungen, termine };
