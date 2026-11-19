// Mirrors photoTones from @kora/design-tokens (kept as plain JS so this tool runs without a TS loader).
import { categories } from './catalog.mjs';
export const photoTones = {
  sand: { bg: '#EFE5D6', bgDeep: '#E2D3BE', shadow: '#B9A285' },
  sage: { bg: '#DDE6DA', bgDeep: '#C9D7C4', shadow: '#8FA58A' },
  blush: { bg: '#F2DFD9', bgDeep: '#E8CBC2', shadow: '#BE968B' },
  mist: { bg: '#DFE6EE', bgDeep: '#CAD5E2', shadow: '#8E9FB3' },
  clay: { bg: '#EBD7C6', bgDeep: '#DEC2AB', shadow: '#B08C70' },
  lilac: { bg: '#E6E0EF', bgDeep: '#D6CCE6', shadow: '#9A8CB2' },
  night: { bg: '#2B3036', bgDeep: '#22262B', shadow: '#0E1012' },
};
export const categoryTone = (slug) => categories.find((c) => c.slug === slug)?.tone ?? 'sand';
