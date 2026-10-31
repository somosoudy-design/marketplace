// Emits CSS custom properties for the web admin from the same tokens.
import { colors, radii, palette } from '../src/index.ts';
import { writeFileSync } from 'node:fs';
const kebab = (s: string) => s.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase());
const block = (o: Record<string, string>) => Object.entries(o).map(([k, v]) => `  --${kebab(k)}: ${v};`).join('\n');
const extra = Object.entries(radii).map(([k, v]) => `  --radius-${k}: ${v}px;`).join('\n');
const css = `/* generated from @kora/design-tokens — do not edit */\n:root {\n${block(colors.light as any)}\n${extra}\n  --amber: ${palette.amber[400]};\n  --coral: ${palette.coral[400]};\n}\n@media (prefers-color-scheme: dark) {\n  :root {\n${block(colors.dark as any)}\n  }\n}\n`;
writeFileSync(process.argv[2] ?? 'tokens.css', css);
console.log('wrote', process.argv[2] ?? 'tokens.css');
