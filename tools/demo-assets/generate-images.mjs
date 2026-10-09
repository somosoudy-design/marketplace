// Generates the demo product illustrations, store logos and covers.
// Output: supabase/seed-assets/{catalog,stores}/demo/*.webp  (served from Storage buckets of the same name)
//
// These are original vector illustrations rendered to WebP — not brand photography — so they carry no
// licensing risk. Each image is labelled "IMAGEN DEMO" and is replaced by real photos via the admin panel.
import sharp from 'sharp';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { products, stores } from './catalog.mjs';
import { photoTones, categoryTone } from './tones.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../supabase/seed-assets');
const W = 800, H = 1000;

// ---------- color utils ----------
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const toHex = (rgb) => '#' + rgb.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
const mix = (a, b, t) => toHex(hex(a).map((v, i) => v + (hex(b)[i] - v) * t));
const light = (c, t) => mix(c, '#FFFFFF', t);
const dark = (c, t) => mix(c, '#000000', t);
const lum = (c) => { const [r, g, b] = hex(c); return (0.299 * r + 0.587 * g + 0.114 * b) / 255; };

let gid = 0;
function grad(c, dir = 'v', a = 0.18, b = 0.16) {
  const id = `g${gid++}`;
  const [x2, y2] = dir === 'v' ? [0, 1] : [1, 0];
  return { id, def: `<linearGradient id="${id}" x1="0" y1="0" x2="${x2}" y2="${y2}"><stop offset="0" stop-color="${light(c, a)}"/><stop offset="1" stop-color="${dark(c, b)}"/></linearGradient>`, url: `url(#${id})` };
}

// ---------- archetypes (object drawn around x=400, resting on y=770) ----------
const A = {
  charger(c, s) {
    const k = s === 'big' ? 1.15 : s === 'mini' ? 0.78 : 1;
    const w = 230 * k, h = 260 * k, x = 400 - w / 2, y = 770 - h;
    const g = grad(c, 'h', 0.25, 0.12); const top = grad(c, 'v', 0.35, 0.02);
    const ports = (s === 'mini' ? [0] : [-1, 0, 1]).map((i) => `<rect x="${400 + i * 52 * k - 16 * k}" y="${y + h * 0.28}" width="${32 * k}" height="${12 * k}" rx="${6 * k}" fill="${dark(c, 0.55)}"/>`).join('');
    return { defs: g.def + top.def, body: `
      <rect x="${400 - 34 * k}" y="${y - 70 * k}" width="${14 * k}" height="${80 * k}" rx="4" fill="#B9BEC5"/>
      <rect x="${400 + 20 * k}" y="${y - 70 * k}" width="${14 * k}" height="${80 * k}" rx="4" fill="#B9BEC5"/>
      <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${48 * k}" fill="${g.url}"/>
      <rect x="${x + 10}" y="${y + 8}" width="${w - 20}" height="${h * 0.18}" rx="${36 * k}" fill="${light(c, 0.35)}" opacity="0.55"/>
      ${ports}
      <text x="400" y="${y + h * 0.72}" text-anchor="middle" font-family="DejaVu Sans" font-weight="bold" font-size="${30 * k}" fill="${dark(c, lum(c) > 0.5 ? 0.35 : -0.6)}" opacity="0.6">GaN</text>` };
  },
  carcharger(c) {
    const g = grad(c, 'h', 0.3, 0.1);
    return { defs: g.def, body: `
      <rect x="352" y="420" width="96" height="300" rx="40" fill="${g.url}"/>
      <rect x="330" y="400" width="140" height="70" rx="30" fill="${light(c, 0.12)}"/>
      <rect x="372" y="424" width="56" height="10" rx="5" fill="${dark(c, 0.6)}"/><rect x="372" y="444" width="56" height="10" rx="5" fill="${dark(c, 0.6)}"/>
      <rect x="380" y="720" width="40" height="50" rx="8" fill="#B9BEC5"/>
      <circle cx="400" cy="600" r="8" fill="#7FD1C0"/>` };
  },
  hub(c, s) {
    const long = s === 'long';
    const w = long ? 470 : 340, h = 110, x = 400 - w / 2, y = 600;
    const g = grad(c, 'v', 0.3, 0.2);
    const n = long ? 6 : 4;
    const ports = Array.from({ length: n }, (_, i) => `<rect x="${x + 40 + i * ((w - 80) / n)}" y="${y + 40}" width="${(w - 120) / n}" height="20" rx="6" fill="${dark(c, 0.6)}"/>`).join('');
    return { defs: g.def, body: `
      <path d="M ${x + 30} ${y + h / 2} C ${x - 80} ${y + h / 2}, ${x - 40} ${y - 220}, ${x + 40} ${y - 260}" stroke="${dark(c, 0.25)}" stroke-width="18" fill="none" stroke-linecap="round"/>
      <rect x="${x + 22}" y="${y - 300}" width="40" height="60" rx="10" fill="${light(c, 0.1)}"/>
      <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="30" fill="${g.url}"/>
      <rect x="${x + 6}" y="${y + 5}" width="${w - 12}" height="22" rx="14" fill="#fff" opacity="0.18"/>
      ${ports}
      <rect x="${x}" y="${y + h - 14}" width="${w}" height="14" rx="7" fill="${dark(c, 0.3)}" opacity="0.5"/>` };
  },
  cable(c) {
    const strokeC = c, hi = light(c, 0.35);
    const loops = [0, 1, 2, 3].map((i) => `<ellipse cx="${400 + i * 6}" cy="${600 - i * 8}" rx="${190 - i * 18}" ry="${120 - i * 12}" fill="none" stroke="${strokeC}" stroke-width="26"/>
      <ellipse cx="${400 + i * 6}" cy="${600 - i * 8}" rx="${190 - i * 18}" ry="${120 - i * 12}" fill="none" stroke="${hi}" stroke-width="5" stroke-dasharray="8 14" opacity="0.6"/>`).join('');
    return { defs: '', body: `${loops}
      <path d="M 560 620 C 640 640 640 720 600 760" stroke="${strokeC}" stroke-width="26" fill="none" stroke-linecap="round"/>
      <rect x="560" y="740" width="80" height="44" rx="14" fill="${light(c, 0.15)}" transform="rotate(-20 600 762)"/>
      <rect x="600" y="752" width="44" height="18" rx="6" fill="#C7CCD2" transform="rotate(-20 600 762)"/>
      <path d="M 240 600 C 170 560 190 470 250 440" stroke="${strokeC}" stroke-width="26" fill="none" stroke-linecap="round"/>
      <rect x="215" y="390" width="70" height="80" rx="16" fill="${light(c, 0.15)}"/><rect x="232" y="356" width="36" height="40" rx="6" fill="#C7CCD2"/>` };
  },
  powerbank(c, s) {
    const slim = s === 'slim';
    const w = slim ? 250 : 270, h = slim ? 360 : 420, x = 400 - w / 2, y = 770 - h;
    const g = grad(c, 'h', 0.25, 0.18);
    return { defs: g.def, body: `
      <rect x="${x + 18}" y="${y + 14}" width="${w}" height="${h}" rx="${slim ? 60 : 44}" fill="${dark(c, 0.35)}"/>
      <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${slim ? 60 : 44}" fill="${g.url}"/>
      ${slim ? `<circle cx="400" cy="${y + h / 2}" r="78" fill="none" stroke="${light(c, 0.4)}" stroke-width="10" opacity="0.7"/>` :
        `<rect x="${x + 40}" y="${y + 40}" width="${w - 80}" height="70" rx="16" fill="${dark(c, 0.55)}"/>
         <text x="400" y="${y + 88}" text-anchor="middle" font-family="DejaVu Sans" font-size="34" fill="#7FD1C0">87%</text>`}
      ${[0, 1, 2, 3].map((i) => `<circle cx="${400 - 36 + i * 24}" cy="${y + h - 50}" r="6" fill="${i < 3 ? '#7FD1C0' : dark(c, 0.4)}"/>`).join('')}
      <rect x="${x + 10}" y="${y + 10}" width="22" height="${h - 20}" rx="11" fill="#fff" opacity="0.14"/>` };
  },
  stand(c) {
    return { defs: '', body: `
      <polygon points="230,770 300,770 520,520 470,500" fill="${dark(c, 0.2)}"/>
      <polygon points="500,770 570,770 600,520 550,520" fill="${dark(c, 0.12)}"/>
      <rect x="250" y="470" width="380" height="40" rx="12" fill="${light(c, 0.15)}" transform="rotate(-14 440 490)"/>
      <rect x="260" y="300" width="360" height="200" rx="12" fill="${dark('#3A3F47', 0)}" transform="rotate(-14 440 400)"/>
      <rect x="276" y="314" width="328" height="170" rx="6" fill="#5A7C9A" transform="rotate(-14 440 400)"/>` };
  },
  keyboard(c) {
    const keys = [];
    for (let r = 0; r < 5; r++) for (let k = 0; k < 12; k++) {
      const accent = (r === 0 && k === 0) || (r === 4 && k > 3 && k < 9);
      if (r === 4 && k > 4 && k < 9) { if (k === 5) keys.push(`<rect x="${238 + 5 * 28}" y="${560 + r * 30}" width="${28 * 4 - 6}" height="24" rx="5" fill="${light(c, 0.2)}"/>`); continue; }
      keys.push(`<rect x="${238 + k * 28}" y="${560 + r * 30}" width="22" height="24" rx="5" fill="${accent ? '#F2A541' : light(c, 0.25)}"/>`);
    }
    return { defs: '', body: `
      <rect x="220" y="540" width="370" height="190" rx="22" fill="${dark(c, 0.18)}" transform="skewX(-8)"/>
      <g transform="skewX(-8)">${keys.join('')}</g>` };
  },
  headphones(c) {
    const g = grad(c, 'h', 0.25, 0.2);
    return { defs: g.def, body: `
      <path d="M 260 600 C 240 330 560 330 540 600" stroke="${dark(c, 0.25)}" stroke-width="34" fill="none" stroke-linecap="round"/>
      <path d="M 262 600 C 244 350 556 350 538 600" stroke="${light(c, 0.2)}" stroke-width="10" fill="none" stroke-linecap="round" opacity="0.6"/>
      <rect x="205" y="560" width="120" height="200" rx="58" fill="${g.url}"/>
      <rect x="475" y="560" width="120" height="200" rx="58" fill="${g.url}"/>
      <rect x="300" y="590" width="34" height="140" rx="17" fill="${dark(c, 0.35)}"/>
      <rect x="466" y="590" width="34" height="140" rx="17" fill="${dark(c, 0.35)}"/>` };
  },
  earbuds(c, s) {
    const g = grad(c, 'v', 0.3, 0.12);
    if (s === 'sport') return { defs: g.def, body: `
      <path d="M 300 520 C 230 420 360 360 380 470" stroke="${dark(c, 0.15)}" stroke-width="22" fill="none" stroke-linecap="round"/>
      <circle cx="350" cy="600" r="70" fill="${g.url}"/><circle cx="350" cy="600" r="30" fill="${dark(c, 0.4)}"/>
      <path d="M 480 540 C 430 440 560 380 580 490" stroke="${dark(c, 0.15)}" stroke-width="22" fill="none" stroke-linecap="round"/>
      <circle cx="520" cy="640" r="70" fill="${g.url}"/><circle cx="520" cy="640" r="30" fill="${dark(c, 0.4)}"/>` };
    return { defs: g.def, body: `
      <rect x="260" y="560" width="280" height="210" rx="100" fill="${g.url}"/>
      <path d="M 262 640 L 538 640" stroke="${dark(c, 0.18)}" stroke-width="4"/>
      <circle cx="400" cy="700" r="6" fill="#7FD1C0"/>
      <g transform="rotate(-18 330 470)"><ellipse cx="330" cy="470" rx="48" ry="56" fill="${light(c, 0.1)}"/><rect x="316" y="490" width="30" height="110" rx="15" fill="${light(c, 0.05)}"/></g>
      <g transform="rotate(16 470 450)"><ellipse cx="470" cy="450" rx="48" ry="56" fill="${light(c, 0.1)}"/><rect x="456" y="470" width="30" height="110" rx="15" fill="${light(c, 0.05)}"/></g>` };
  },
  speaker(c) {
    const g = grad(c, 'h', 0.25, 0.25);
    return { defs: g.def, body: `
      <rect x="250" y="440" width="300" height="330" rx="70" fill="${g.url}"/>
      <rect x="270" y="470" width="260" height="240" rx="50" fill="${dark(c, 0.15)}"/>
      ${Array.from({ length: 9 }, (_, r) => Array.from({ length: 9 }, (_, k) => `<circle cx="${300 + k * 25}" cy="${495 + r * 24}" r="4" fill="${dark(c, 0.45)}"/>`).join('')).join('')}
      <rect x="320" y="420" width="160" height="40" rx="20" fill="${dark(c, 0.3)}"/>
      <rect x="250" y="440" width="34" height="330" rx="17" fill="#fff" opacity="0.12"/>` };
  },
  lipstick(c) {
    const gold = grad('#C9A15A', 'h', 0.35, 0.25); const body = grad('#2A2C30', 'h', 0.25, 0.2);
    return { defs: gold.def + body.def, body: `
      <rect x="215" y="560" width="100" height="210" rx="16" fill="${body.url}"/>
      <rect x="215" y="530" width="100" height="40" rx="6" fill="${gold.url}"/>
      <rect x="430" y="470" width="120" height="300" rx="18" fill="${body.url}" transform="rotate(8 490 620)"/>
      <rect x="350" y="580" width="110" height="190" rx="16" fill="${body.url}"/>
      <rect x="350" y="545" width="110" height="45" rx="6" fill="${gold.url}"/>
      <path d="M 365 545 L 365 440 Q 365 395 445 380 L 445 545 Z" fill="${c}"/>
      <path d="M 372 540 L 372 450 Q 375 415 400 404" stroke="${light(c, 0.3)}" stroke-width="8" fill="none" opacity="0.6"/>` };
  },
  gloss(c) {
    const tube = grad(c, 'h', 0.35, 0.1);
    return { defs: tube.def, body: `
      <g transform="rotate(-10 400 560)">
        <rect x="350" y="430" width="100" height="340" rx="30" fill="${tube.url}"/>
        <rect x="350" y="430" width="100" height="340" rx="30" fill="#fff" opacity="0.18"/>
        <rect x="365" y="440" width="18" height="300" rx="9" fill="#fff" opacity="0.4"/>
        <rect x="355" y="300" width="90" height="140" rx="14" fill="#2A2C30"/>
      </g>
      <g transform="rotate(14 540 620)"><rect x="510" y="520" width="60" height="250" rx="22" fill="${tube.url}"/><rect x="514" y="430" width="52" height="100" rx="10" fill="#2A2C30"/></g>` };
  },
  foundation(c) {
    const glass = grad(light(c, 0.1), 'h', 0.3, 0.15);
    return { defs: glass.def, body: `
      <rect x="290" y="480" width="220" height="290" rx="36" fill="${glass.url}"/>
      <rect x="306" y="500" width="30" height="240" rx="15" fill="#fff" opacity="0.35"/>
      <rect x="350" y="430" width="100" height="60" rx="8" fill="#2A2C30"/>
      <rect x="380" y="380" width="40" height="60" rx="8" fill="#2A2C30"/>
      <rect x="395" y="370" width="70" height="22" rx="8" fill="#2A2C30"/>
      <rect x="330" y="620" width="140" height="70" rx="10" fill="#fff" opacity="0.65"/>
      <rect x="350" y="640" width="100" height="10" rx="5" fill="#2A2C30" opacity="0.5"/><rect x="365" y="660" width="70" height="8" rx="4" fill="#2A2C30" opacity="0.35"/>` };
  },
  blush(c) {
    const g = grad(c, 'h', 0.25, 0.15);
    return { defs: g.def, body: `
      <rect x="320" y="520" width="160" height="250" rx="40" fill="${g.url}"/>
      <rect x="334" y="540" width="20" height="200" rx="10" fill="#fff" opacity="0.35"/>
      <rect x="340" y="400" width="120" height="130" rx="16" fill="#F4F2EE"/>
      <rect x="348" y="410" width="16" height="110" rx="8" fill="#fff"/>` };
  },
  palette(c) {
    const shades = [light(c, 0.55), light(c, 0.3), c, dark(c, 0.2), '#C9A15A', dark(c, 0.45), light('#8A5B3D', 0.2), '#E9C6A8', dark(c, 0.6)];
    return { defs: '', body: `
      <rect x="220" y="520" width="360" height="250" rx="26" fill="#2A2C30"/>
      <rect x="220" y="360" width="360" height="170" rx="26" fill="#3A3D44"/>
      <rect x="240" y="378" width="320" height="136" rx="16" fill="#C9CDD2" opacity="0.6"/>
      ${shades.map((s, i) => `<rect x="${244 + (i % 3) * 108}" y="${540 + Math.floor(i / 3) * 74}" width="96" height="62" rx="12" fill="${s}"/>`).join('')}` };
  },
  brushes(c) {
    return { defs: '', body: [[-28, 300, 70], [-10, 360, 56], [8, 380, 50], [26, 330, 62]].map(([rot, x, w], i) => `
      <g transform="rotate(${rot} ${x + w / 2} 770)">
        <rect x="${x + w / 2 - 12}" y="520" width="24" height="250" rx="12" fill="${i % 2 ? c : dark(c, 0.15)}"/>
        <rect x="${x + w / 2 - 16}" y="470" width="32" height="60" rx="6" fill="#C9A15A"/>
        <path d="M ${x} 470 Q ${x + w / 2} ${330 - i * 10} ${x + w} 470 Z" fill="${i % 2 ? '#3A2E2A' : '#E9DCCB'}"/>
      </g>`).join('') };
  },
  compact(c) {
    return { defs: '', body: `
      <ellipse cx="400" cy="700" rx="200" ry="70" fill="#2A2C30"/>
      <rect x="200" y="640" width="400" height="60" fill="#2A2C30"/>
      <ellipse cx="400" cy="640" rx="200" ry="70" fill="#3A3D44"/>
      <ellipse cx="400" cy="640" rx="170" ry="56" fill="${c}"/>
      <ellipse cx="380" cy="630" rx="100" ry="26" fill="#fff" opacity="0.3"/>
      <ellipse cx="400" cy="460" rx="200" ry="70" fill="#3A3D44" transform="rotate(-8 400 460)"/>
      <ellipse cx="400" cy="460" rx="170" ry="56" fill="#C9CDD2" opacity="0.7" transform="rotate(-8 400 460)"/>` };
  },
  sponge(c) {
    const g = grad(c, 'v', 0.25, 0.12);
    return { defs: g.def, body: [[300, 650, 0], [500, 640, 18], [400, 560, -10], [400, 700, 6]].map(([x, y, r]) => `
      <g transform="rotate(${r} ${x} ${y})"><path d="M ${x} ${y - 100} C ${x + 80} ${y - 100} ${x + 85} ${y + 70} ${x} ${y + 70} C ${x - 85} ${y + 70} ${x - 80} ${y - 100} ${x} ${y - 100} Z" fill="${g.url}"/>
      <ellipse cx="${x - 20}" cy="${y - 40}" rx="16" ry="30" fill="#fff" opacity="0.25"/></g>`).join('') };
  },
  watch(c) {
    const g = grad(c, 'v', 0.2, 0.2);
    return { defs: g.def, body: `
      <rect x="345" y="300" width="110" height="480" rx="40" fill="${g.url}"/>
      <rect x="290" y="430" width="220" height="250" rx="64" fill="#2A2C30"/>
      <rect x="305" y="445" width="190" height="220" rx="52" fill="#121416"/>
      <text x="400" y="555" text-anchor="middle" font-family="DejaVu Sans" font-size="54" fill="#F4F2EE">10:09</text>
      <rect x="350" y="585" width="100" height="8" rx="4" fill="#7FD1C0"/>
      <rect x="505" y="500" width="16" height="50" rx="8" fill="#3A3D44"/>` };
  },
  backpack(c) {
    const g = grad(c, 'h', 0.2, 0.2);
    return { defs: g.def, body: `
      <path d="M 340 360 Q 400 300 460 360" stroke="${dark(c, 0.3)}" stroke-width="22" fill="none"/>
      <rect x="260" y="360" width="280" height="410" rx="80" fill="${g.url}"/>
      <rect x="300" y="560" width="200" height="160" rx="36" fill="${dark(c, 0.15)}"/>
      <rect x="300" y="560" width="200" height="26" rx="13" fill="${dark(c, 0.3)}"/>
      <rect x="380" y="590" width="40" height="12" rx="6" fill="#C9A15A"/>
      <rect x="276" y="380" width="26" height="360" rx="13" fill="#fff" opacity="0.12"/>` };
  },
  mirrors(c) {
    return { defs: '', body: [-24, -8, 8, 24].map((r, i) => `
      <g transform="rotate(${r} 400 770)">
        <rect x="392" y="440" width="16" height="330" rx="8" fill="${i % 2 ? '#AEB4BB' : '#C9CDD2'}"/>
        <rect x="389" y="520" width="22" height="160" rx="8" fill="#9CA3AB"/>
        <circle cx="400" cy="420" r="38" fill="#E6EAEE" stroke="#9CA3AB" stroke-width="6"/>
        <circle cx="390" cy="410" r="12" fill="#fff" opacity="0.8"/>
      </g>`).join('') };
  },
  instruments(c) {
    return { defs: '', body: `
      <rect x="240" y="640" width="320" height="130" rx="18" fill="#7FA9C9" opacity="0.85"/>
      ${[0, 1, 2, 3].map((i) => `<rect x="${270 + i * 74}" y="${400 + (i % 2) * 20}" width="14" height="300" rx="7" fill="#C9CDD2"/>
      <path d="M ${277 + i * 74} ${400 + (i % 2) * 20} q ${i % 2 ? 20 : -20} -30 0 -60" stroke="#AEB4BB" stroke-width="6" fill="none"/>`).join('')}` };
  },
  glovebox(c) {
    const g = grad(light(c, 0.75), 'h', 0.05, 0.08);
    return { defs: g.def, body: `
      <polygon points="230,500 520,450 600,520 310,575" fill="${light(c, 0.85)}"/>
      <polygon points="230,500 310,575 310,780 230,700" fill="${light(c, 0.55)}"/>
      <polygon points="310,575 600,520 600,720 310,780" fill="${g.url}"/>
      <ellipse cx="420" cy="512" rx="80" ry="22" fill="${dark(c, 0.1)}" transform="rotate(-10 420 512)"/>
      <path d="M 390 505 q 20 -60 40 -10 q 10 -50 30 -5" fill="${c}"/>
      <rect x="350" y="620" width="200" height="16" rx="8" fill="${c}" transform="rotate(-10 450 628)"/>
      <rect x="350" y="650" width="140" height="10" rx="5" fill="${c}" opacity="0.6" transform="rotate(-10 420 655)"/>` };
  },
  ejectors(c) {
    return { defs: '', body: `
      <path d="M 260 470 Q 400 420 540 470 L 560 770 L 240 770 Z" fill="#F4F2EE" opacity="0.85"/>
      ${Array.from({ length: 9 }, (_, i) => `<path d="M ${290 + i * 28} 760 L ${300 + i * 26} ${470 - (i % 3) * 20} q 10 -30 30 -20" stroke="${i % 2 ? c : light(c, 0.4)}" stroke-width="12" fill="none" stroke-linecap="round"/>`).join('')}
      <path d="M 260 470 Q 400 420 540 470" stroke="#fff" stroke-width="10" fill="none"/>` };
  },
  bibs(c) {
    return { defs: '', body: Array.from({ length: 7 }, (_, i) => `<rect x="${250 + (i % 2) * 6}" y="${720 - i * 34}" width="300" height="40" rx="6" fill="${i % 2 ? light(c, 0.3) : light(c, 0.55)}"/>`).join('') +
      `<rect x="240" y="470" width="320" height="300" rx="14" fill="none" stroke="#fff" stroke-width="6" opacity="0.6"/><rect x="330" y="540" width="140" height="40" rx="8" fill="#fff" opacity="0.8"/>` };
  },
  curinglight(c) {
    return { defs: '', body: `
      <rect x="430" y="610" width="160" height="160" rx="40" fill="#E6EAEE"/><rect x="470" y="640" width="80" height="30" rx="15" fill="#2F9580"/>
      <g transform="rotate(-24 360 560)"><rect x="320" y="380" width="80" height="380" rx="38" fill="#F4F2EE"/>
      <rect x="330" y="300" width="20" height="120" rx="10" fill="#C9CDD2" transform="rotate(30 340 360)"/>
      <rect x="342" y="560" width="36" height="20" rx="10" fill="#2F9580"/><rect x="320" y="380" width="22" height="380" rx="11" fill="#fff" opacity="0.6"/></g>
      <circle cx="292" cy="340" r="26" fill="#6F8CFF" opacity="0.55"/>` };
  },
  trays(c) {
    return { defs: '', body: `
      <path d="M 220 650 Q 220 520 360 520 Q 500 520 500 650 L 470 650 Q 470 560 360 560 Q 250 560 250 650 Z" fill="#C9CDD2" stroke="#9CA3AB" stroke-width="4"/>
      <rect x="345" y="640" width="30" height="130" rx="10" fill="#AEB4BB"/>
      <path d="M 330 560 Q 330 430 470 430 Q 610 430 610 560 L 580 560 Q 580 470 470 470 Q 360 470 360 560 Z" fill="#E6EAEE" stroke="#9CA3AB" stroke-width="4"/>
      <rect x="455" y="550" width="30" height="220" rx="10" fill="#C9CDD2"/>` };
  },
  lamp(c) {
    return { defs: '', body: `
      <path d="M 300 330 L 500 330 L 560 520 L 240 520 Z" fill="#EFE6D6"/>
      <path d="M 300 330 L 340 330 L 300 520 L 240 520 Z" fill="#fff" opacity="0.5"/>
      <rect x="390" y="520" width="20" height="120" fill="#C9A15A"/>
      <path d="M 320 640 Q 400 600 480 640 L 470 770 L 330 770 Z" fill="${c}"/>
      <ellipse cx="400" cy="560" rx="200" ry="40" fill="#FAD08F" opacity="0.25"/>` };
  },
  mugs(c) {
    const one = (x, y, k, col) => `<g transform="translate(${x} ${y}) scale(${k})">
      <rect x="-80" y="-170" width="160" height="170" rx="26" fill="${col}"/>
      <path d="M 78 -130 q 70 0 60 60 q -10 40 -60 40" stroke="${col}" stroke-width="20" fill="none"/>
      <rect x="-70" y="-160" width="22" height="140" rx="11" fill="#fff" opacity="0.25"/>
      <ellipse cx="0" cy="-170" rx="80" ry="16" fill="${dark(col, 0.3)}"/></g>`;
    return { defs: '', body: one(300, 770, 0.9, light(c, 0.15)) + one(470, 770, 1.1, c) + one(380, 600, 0.7, dark(c, 0.1)) };
  },
  candle(c) {
    return { defs: '', body: `
      <path d="M 300 420 L 500 420 L 490 770 L 310 770 Z" fill="#B56D16" opacity="0.85"/>
      <path d="M 312 500 L 488 500 L 482 760 L 318 760 Z" fill="${c}"/>
      <rect x="320" y="430" width="24" height="320" rx="12" fill="#fff" opacity="0.3"/>
      <rect x="350" y="590" width="100" height="80" rx="8" fill="#F4F2EE"/>
      <rect x="397" y="460" width="6" height="40" fill="#3A2E2A"/>
      <path d="M 400 400 Q 420 440 400 462 Q 380 440 400 400 Z" fill="#F6B85A"/>` };
  },
  towels(c) {
    return { defs: '', body: [0, 1, 2, 3].map((i) => `<rect x="${240 + i * 6}" y="${690 - i * 70}" width="${320 - i * 12}" height="80" rx="34" fill="${i % 2 ? light(c, 0.25) : c}"/>
      <rect x="${240 + i * 6}" y="${745 - i * 70}" width="${320 - i * 12}" height="12" fill="${dark(c, 0.15)}" opacity="0.5"/>`).join('') };
  },
  organizer(c) {
    const g = grad(c, 'v', 0.2, 0.2);
    return { defs: g.def, body: `
      <rect x="240" y="560" width="320" height="210" rx="14" fill="${g.url}"/>
      <rect x="250" y="560" width="300" height="20" fill="${dark(c, 0.25)}"/>
      ${[0, 1, 2].map((i) => `<rect x="${250 + i * 102}" y="580" width="8" height="190" fill="${dark(c, 0.2)}"/>`).join('')}
      <rect x="275" y="420" width="16" height="170" rx="6" fill="#2A2C30"/><rect x="300" y="460" width="16" height="130" rx="6" fill="#F2A541"/>
      <rect x="380" y="470" width="60" height="110" rx="8" fill="#F4F2EE"/><rect x="470" y="440" width="12" height="150" rx="6" fill="#137A67"/>` };
  },
  petbed(c) {
    return { defs: '', body: `
      <ellipse cx="400" cy="690" rx="260" ry="100" fill="${dark(c, 0.15)}"/>
      <ellipse cx="400" cy="660" rx="260" ry="100" fill="${c}"/>
      <ellipse cx="400" cy="660" rx="185" ry="60" fill="${light(c, 0.55)}"/>
      <ellipse cx="370" cy="650" rx="90" ry="22" fill="#fff" opacity="0.3"/>` };
  },
  bowl(c) {
    const one = (x) => `<path d="M ${x - 120} 640 L ${x + 120} 640 L ${x + 90} 740 L ${x - 90} 740 Z" fill="#AEB4BB"/>
      <ellipse cx="${x}" cy="640" rx="120" ry="34" fill="#E6EAEE"/><ellipse cx="${x}" cy="640" rx="92" ry="22" fill="#9CA3AB"/>`;
    return { defs: '', body: `<rect x="190" y="720" width="420" height="50" rx="25" fill="#2A2C30"/>${one(305)}${one(495)}` };
  },
  rope(c) {
    const seg = (x, y, col) => `<ellipse cx="${x}" cy="${y}" rx="34" ry="22" fill="${col}"/>`;
    const pts = Array.from({ length: 12 }, (_, i) => [260 + i * 26, 560 + Math.sin(i / 1.6) * 60]);
    return { defs: '', body: pts.map(([x, y], i) => seg(x, y, i % 2 ? c : '#F4F2EE')).join('') +
      `<circle cx="240" cy="560" r="56" fill="${c}"/><circle cx="560" cy="580" r="56" fill="#F4F2EE"/>` +
      `<path d="M 200 610 l -20 80 M 230 615 l -6 90 M 600 630 l 20 80 M 570 635 l 6 90" stroke="${c}" stroke-width="12" stroke-linecap="round"/>` };
  },
  scratcher(c) {
    return { defs: '', body: `
      <rect x="250" y="730" width="300" height="40" rx="12" fill="${c}"/>
      <rect x="370" y="420" width="60" height="320" fill="#D9C6A2"/>
      ${Array.from({ length: 12 }, (_, i) => `<rect x="370" y="${430 + i * 26}" width="60" height="5" fill="#B59C72"/>`).join('')}
      <rect x="290" y="390" width="220" height="40" rx="12" fill="${c}"/>
      <rect x="320" y="300" width="160" height="96" rx="40" fill="${dark(c, 0.08)}"/>
      <circle cx="470" cy="470" r="18" fill="#E0563F"/><path d="M 470 430 L 470 452" stroke="#7D6C58" stroke-width="3"/>` };
  },
  leash(c) {
    return { defs: '', body: `
      <path d="M 260 760 C 200 600 320 520 420 560 C 520 600 600 520 560 420" stroke="${c}" stroke-width="30" fill="none" stroke-linecap="round"/>
      <path d="M 260 760 C 200 600 320 520 420 560 C 520 600 600 520 560 420" stroke="#F4F2EE" stroke-width="4" stroke-dasharray="14 10" fill="none"/>
      <ellipse cx="560" cy="380" rx="56" ry="70" fill="none" stroke="${c}" stroke-width="26"/>
      <rect x="236" y="740" width="50" height="40" rx="8" fill="#C9CDD2"/>` };
  },
};

function frame(tone, inner, { detail = false, label = true } = {}) {
  const t = photoTones[tone];
  const bodyT = detail ? `<g transform="translate(400 560) scale(1.7) translate(-400 -560)">${inner.body}</g>`
    : `<g transform="translate(400 700) scale(1.22) translate(-400 -700)">${inner.body}</g>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <radialGradient id="bg" cx="0.5" cy="${detail ? 0.45 : 0.38}" r="0.85"><stop offset="0" stop-color="${light(t.bg, 0.35)}"/><stop offset="0.6" stop-color="${t.bg}"/><stop offset="1" stop-color="${t.bgDeep}"/></radialGradient>
    <linearGradient id="floor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${t.bgDeep}" stop-opacity="0"/><stop offset="1" stop-color="${t.bgDeep}" stop-opacity="0.9"/></linearGradient>
    <filter id="blur" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="18"/></filter>
    ${inner.defs}
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <rect y="${H * 0.68}" width="${W}" height="${H * 0.32}" fill="url(#floor)"/>
  ${detail ? '' : `<ellipse cx="400" cy="788" rx="280" ry="36" fill="${t.shadow}" opacity="0.55" filter="url(#blur)"/>`}
  ${bodyT}
  ${label ? `<g opacity="0.55"><rect x="28" y="${H - 64}" width="150" height="34" rx="17" fill="#FFFFFF" opacity="0.6"/>
  <text x="103" y="${H - 41}" text-anchor="middle" font-family="DejaVu Sans" font-weight="bold" font-size="14" letter-spacing="2" fill="#3A322A">IMAGEN DEMO</text></g>` : ''}
</svg>`;
}

async function render(svg, out, width = W) {
  mkdirSync(dirname(out), { recursive: true });
  await sharp(Buffer.from(svg)).resize({ width }).webp({ quality: 86 }).toFile(out);
}

const manifest = {};
let count = 0;
for (const p of products) {
  const tone = categoryTone(p.category);
  const draw = A[p.archetype];
  if (!draw) throw new Error('missing archetype ' + p.archetype);
  const imgs = [];
  const base = draw(p.color, p.variantStyle);
  await render(frame(tone, base), join(ROOT, 'catalog/demo', `${p.slug}-1.webp`));
  imgs.push(`demo/${p.slug}-1.webp`);
  await render(frame(tone, draw(p.color, p.variantStyle), { detail: true }), join(ROOT, 'catalog/demo', `${p.slug}-2.webp`));
  imgs.push(`demo/${p.slug}-2.webp`);
  // per-variant color shots
  for (const [i, v] of (p.variants ?? []).entries()) {
    if (v.color && v.color !== p.color) {
      await render(frame(tone, draw(v.color, p.variantStyle)), join(ROOT, 'catalog/demo', `${p.slug}-v${i}.webp`));
      imgs.push(`demo/${p.slug}-v${i}.webp`);
    }
  }
  manifest[p.slug] = imgs;
  count += imgs.length;
}

// stores: logo + cover composed from their products
const accents = { jade: '#0E5E54', amber: '#DB8A22', coral: '#E0563F', plum: '#6E4A86', ink: '#3A322A', sky: '#3C7DBF' };
for (const s of stores) {
  const a = accents[s.accent];
  const logo = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" rx="64" fill="${a}"/>
    <text x="128" y="${s.monogram.length > 1 ? 154 : 166}" text-anchor="middle" font-family="DejaVu Serif" font-weight="bold" font-size="${s.monogram.length > 1 ? 92 : 120}" fill="#FFFDF9">${s.monogram}</text></svg>`;
  await render(logo, join(ROOT, 'stores/demo', `${s.slug}-logo.webp`), 256);
  const t = photoTones[s.tone];
  const own = products.filter((p) => p.store === s.slug).slice(0, 3);
  const minis = own.map((p, i) => { const d = A[p.archetype](p.color, p.variantStyle); return { defs: d.defs, body: `<g transform="translate(${180 + i * 420} 60) scale(0.62)">${d.body}</g>` }; });
  const cover = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="675" viewBox="0 0 1200 675">
    <defs><radialGradient id="c" cx="0.3" cy="0.3" r="1"><stop offset="0" stop-color="${light(t.bg, 0.3)}"/><stop offset="1" stop-color="${t.bgDeep}"/></radialGradient>${minis.map((m) => m.defs).join('')}</defs>
    <rect width="1200" height="675" fill="url(#c)"/><circle cx="1080" cy="80" r="260" fill="${a}" opacity="0.12"/>
    ${minis.map((m) => m.body).join('')}
    <g opacity="0.55"><rect x="28" y="611" width="150" height="34" rx="17" fill="#fff" opacity="0.6"/><text x="103" y="634" text-anchor="middle" font-family="DejaVu Sans" font-weight="bold" font-size="14" letter-spacing="2" fill="#3A322A">IMAGEN DEMO</text></g></svg>`;
  await render(cover, join(ROOT, 'stores/demo', `${s.slug}-cover.webp`), 1200);
}

writeFileSync(join(ROOT, 'manifest.json'), JSON.stringify(manifest, null, 2));
console.log(`generated ${count} product images and ${stores.length * 2} store images`);

// demo payment proof for the seeded bank-transfer payment (buyer 2)
const proof = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="900"><rect width="600" height="900" fill="#FBF7F1"/>
  <rect x="40" y="40" width="520" height="820" rx="24" fill="#fff" stroke="#E2D5C3" stroke-width="3"/>
  <text x="300" y="130" text-anchor="middle" font-family="DejaVu Sans" font-weight="bold" font-size="30" fill="#3A322A">COMPROBANTE DEMO</text>
  <text x="300" y="175" text-anchor="middle" font-family="DejaVu Sans" font-size="18" fill="#7D6C58">Transferencia ficticia · sin valor</text>
  ${['Banco: Banco de Demostración', 'Referencia: 000123456789', 'Monto: (ver cotización)', 'Titular: Compradora Demo'].map((t, i) => `<text x="90" y="${300 + i * 70}" font-family="DejaVu Sans" font-size="22" fill="#3A322A">${t}</text>`).join('')}
  <rect x="90" y="640" width="420" height="120" rx="16" fill="#E8F4F1"/><text x="300" y="712" text-anchor="middle" font-family="DejaVu Sans" font-weight="bold" font-size="24" fill="#0E5E54">OPERACIÓN DE PRUEBA</text></svg>`;
for (const u of ['00000000-0000-4000-a000-000000000004', '00000000-0000-4000-a000-000000000005']) {
  await render(proof, join(ROOT, 'payment-proofs', u, 'demo-comprobante.webp'), 600);
}
