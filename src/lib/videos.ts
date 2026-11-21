// Videos liegen in R2 (Binding MEDIEN), nicht im Repo (Entscheidung 21.11.).
// Die Seite verlinkt saubere Adressen /medien/video/<name>.<format>; der Worker (worker/video.ts)
// liest nur die hier eingetragenen Schlüssel. Neue Videos: Datei in R2 hochladen, hier eintragen.
// webm (VP9) zuerst, mp4 (H.264) als Rückfall für Browser ohne WebM (ältere iPhones).
export const VIDEOS = {
  startseite: { webm: 'medien/Copter Hero_1.webm', mp4: 'medien/Copter Hero_1.mp4' },
  kueche: { webm: 'medien/Küche Hero_1.webm', mp4: 'medien/Küche Hero_1.mp4' },
  seminarraum: { webm: 'medien/Seminarraum Hero_1.webm', mp4: 'medien/Seminarraum Hero_1.mp4' },
  imagefilm: { mp4: 'medien/Imagefilm 1080p.mp4' },
} as const satisfies Record<string, { webm?: string; mp4?: string }>;

export type VideoName = keyof typeof VIDEOS;
export type VideoFormat = 'webm' | 'mp4';

/** Quellen für <video>, in der Reihenfolge webm, mp4 */
export function videoQuellen(name: VideoName): { src: string; type: string }[] {
  const v = VIDEOS[name] as { webm?: string; mp4?: string };
  return (['webm', 'mp4'] as const).filter((f) => v[f]).map((f) => ({ src: `/medien/video/${name}.${f}`, type: `video/${f}` }));
}
