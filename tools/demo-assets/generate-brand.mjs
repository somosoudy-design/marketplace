// Generates the provisional brand mark (app icon, adaptive icon layers, splash, favicon) from vector shapes.
// Replace these files when the final brand exists; nothing else references the artwork directly.
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';

const out = join(import.meta.dirname, '../../apps/mobile/assets/images');
// the coloured native files live apart: app.config.ts switches to them with a new APK (NATIVE_IDENTITY)
const violet = join(out, 'violet');
mkdirSync(violet, { recursive: true });

// Electric Violet: violet field, white stem and leaf, the coral leaf echoes the spark next to the wordmark
const VIOLET = '#6D42E8';
const WHITE = '#FFFFFF';
const CORAL = '#FF746B';
const INK = '#1C1928';

/** A "K" drawn as a stem and two leaves (growth, harvest, exchange). Coordinates on a 1024 canvas. */
function mark({ stem, upper, lower, scale = 1, dx = 0, dy = 0 }) {
  return `<g transform="translate(${dx} ${dy}) translate(512 512) scale(${scale}) translate(-512 -512)">
    <rect x="330" y="270" width="104" height="484" rx="52" fill="${stem}"/>
    <path d="M474 512 Q680 498 724 282 Q524 300 474 512 Z" fill="${upper}"/>
    <path d="M474 512 Q524 724 724 742 Q680 526 474 512 Z" fill="${lower}"/>
  </g>`;
}
const svg = (body, bg) =>
  Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">${bg ? `<rect width="1024" height="1024" fill="${bg}"/>` : ''}${body}</svg>`);

const jobs = [
  ['violet/icon.png', svg(mark({ stem: WHITE, upper: CORAL, lower: WHITE, scale: 0.92 }), VIOLET), 1024],
  ['violet/android-icon-background.png', svg('', VIOLET), 1024],
  // adaptive foreground: keep the mark inside the 66% safe zone
  ['violet/android-icon-foreground.png', svg(mark({ stem: WHITE, upper: CORAL, lower: WHITE, scale: 0.62 })), 1024],
  ['android-icon-monochrome.png', svg(mark({ stem: '#FFFFFF', upper: '#FFFFFF', lower: '#FFFFFF', scale: 0.62 })), 1024],
  ['violet/splash-icon.png', svg(mark({ stem: VIOLET, upper: CORAL, lower: INK })), 512],
  ['violet/splash-icon-dark.png', svg(mark({ stem: '#A98CFF', upper: CORAL, lower: WHITE })), 512],
  ['notification-icon.png', svg(mark({ stem: '#FFFFFF', upper: '#FFFFFF', lower: '#FFFFFF', scale: 0.8 })), 96],
  ['favicon.png', svg(mark({ stem: WHITE, upper: CORAL, lower: WHITE, scale: 0.9 }), VIOLET), 48],
];

for (const [name, data, size] of jobs) {
  await sharp(data).resize(size, size).png().toFile(join(out, name));
  console.log('·', name);
}
