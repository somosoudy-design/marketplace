import { optionSwatchTone } from '@kora/core';
import { palette } from '@kora/design-tokens';

const fills = { black: palette.ink[900], white: palette.ink[0], gray: palette.ink[500], purple: palette.violet[400] };
export function ColorDot({ label }: { label: string }) {
  const tone = optionSwatchTone(label);
  return <span aria-hidden="true" className="variant-color-dot" data-testid="color-swatch" style={{ backgroundColor: tone ? fills[tone] : 'transparent' }} />;
}
