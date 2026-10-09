import type { TypographyVariant } from '@kora/design-tokens';
import { Text as RNText, type TextProps } from 'react-native';
import { useTheme } from '@/theme';

type ColorName = 'text' | 'textSecondary' | 'textMuted' | 'textInverse' | 'brand' | 'onBrand' | 'danger' | 'success' | 'warning' | 'info' | 'editorial' | 'accent';

export interface AppTextProps extends TextProps {
  variant?: TypographyVariant;
  color?: ColorName;
  align?: 'left' | 'center' | 'right';
  tabular?: boolean;
}

export function Text({ variant = 'body', color = 'text', align, tabular, style, ...rest }: AppTextProps) {
  const t = useTheme();
  const isHeading = variant.startsWith('display') || variant === 'title';
  return (
    <RNText
      accessibilityRole={isHeading ? 'header' : undefined}
      maxFontSizeMultiplier={1.6}
      style={[
        t.typography[variant],
        { color: t.colors[color] },
        align ? { textAlign: align } : null,
        tabular ? { fontVariant: ['tabular-nums'] } : null,
        variant === 'overline' ? { textTransform: 'uppercase' } : null,
        style,
      ]}
      {...rest}
    />
  );
}
