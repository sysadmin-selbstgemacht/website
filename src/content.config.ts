import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

// Schema für Termine (Option A).
// Ein Eintrag, der nicht passt, lässt den Build scheitern und geht nicht live.
// Felder nach Project Brief 6c; Kategorie nach den Stichpunkten zur Seitenstruktur.
const termine = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/termine' }),
  schema: z
    .object({
      titel: z.string().min(3).max(120),
      kategorie: z.enum(['veranstaltung', 'kurs', 'retreat', 'das-laeuft-bei-uns']),
      leitung: z.string().min(2),
      beginn: z.coerce.date(),
      ende: z.coerce.date(),
      naechte: z.number().int().min(0).max(30),
      kursgebuehr: z.string().optional(), // z. B. "390 € zzgl. Übernachtung"
      eigener_termin: z.boolean(), // true: Anfrageformular des Hauses; false: Kontakt der Kursleitung
      kontakt_mail: z.string().email().optional(),
      kontakt_web: z.string().url().optional(),
      entwurf: z.boolean().default(false),
    })
    .refine((t) => t.ende >= t.beginn, { message: 'ende liegt vor beginn' })
    .refine((t) => t.eigener_termin || t.kontakt_mail || t.kontakt_web, {
      message: 'externe Termine brauchen kontakt_mail oder kontakt_web',
    }),
});

export const collections = { termine };
