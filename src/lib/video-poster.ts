// Vorschaubilder für Videos: erstes Bild des Films (aus der Videodatei gezogen, 21.11.).
// Getrennt von videos.ts, weil der Worker videos.ts liest und keine Bilder kennt.
import { getImage } from 'astro:assets';
import type { ImageMetadata } from 'astro';
import type { VideoName } from './videos';
import imagefilm from '../assets/bilder/poster/imagefilm.webp';
import seminarraum from '../assets/bilder/poster/seminarraum.webp';

const POSTER: Partial<Record<VideoName, ImageMetadata>> = { imagefilm, seminarraum };

export async function videoPoster(name: VideoName, breite = 1600): Promise<string | undefined> {
  const bild = POSTER[name];
  return bild ? (await getImage({ src: bild, width: breite, format: 'webp' })).src : undefined;
}
