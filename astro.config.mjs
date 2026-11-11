// @ts-check
import { defineConfig } from 'astro/config';

// Rein statischer Build, keine Integrationen.
// `site` wird beim Go-live auf https://selbst-gemacht.eu gesetzt.
export default defineConfig({
  output: 'static',
  site: 'https://selbst-gemacht.pages.dev',
});
