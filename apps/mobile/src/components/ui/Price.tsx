import { formatUSD, formatVES, D } from '@kora/core';
import { View } from 'react-native';
import { useTheme } from '@/theme';
import { Badge } from './Badge';
import { Icon } from './Icon';
import { ScalePressable } from './Pressable';
import { Text } from './Text';

interface Props {
  usd: number | string;
  compareAt?: number | string | null;
  size?: 'sm' | 'md' | 'lg';
  /** Reference rate (USD/VES) to show the bolívar equivalent. Omitted when no current rate is available. */
  vesRate?: { rate: number; demo: boolean } | null;
  /** The day's gap (useDivisas()) to show what Zelle/USDT pay. Omitted when no gap is in force. */
  divisas?: { best: number; label: string } | null;
  muted?: boolean;
  /** Makes the bolívar line open the rate details (where the figure comes from). */
  onRatePress?: () => void;
}

/**
 * The main price is in dollars at the BCV rate; the divisas pill says what Zelle/USDT pay with today's gap and the
 * VES line converts the main price at today's rate (docs/PRECIOS.md). Both are references: the quote at payment
 * decides. The special price is what a buyer acts on, so it reads first; the bolívar line stays quiet.
 */
export function Price({ usd, compareAt, size = 'md', vesRate, divisas, muted, onRatePress }: Props) {
  const t = useTheme();
  const showCompare = compareAt != null && D(compareAt).gt(usd);
  const off = showCompare ? D(1).minus(D(usd).div(compareAt!)).times(100).toDecimalPlaces(0).toNumber() : 0;
  const inDivisas = divisas && divisas.best < 1 ? D(usd).times(divisas.best) : null;
  const saving = inDivisas ? D(1).minus(divisas!.best).times(100).toDecimalPlaces(1).toNumber() : 0;
  const ves = vesRate ? `≈ ${formatVES(D(usd).times(vesRate.rate))} ${vesRate.demo ? 'con tasa de demostración' : 'a la tasa de hoy'}` : null;
  return (
    <View style={{ gap: size === 'lg' ? 8 : 0 }}>
      <View accessible accessibilityLabel={`Precio ${formatUSD(usd)}${showCompare ? `, antes ${formatUSD(compareAt)}` : ''}`} style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
        <Text variant={size === 'lg' ? 'priceLarge' : 'price'} color={muted ? 'textMuted' : 'text'} tabular style={size === 'sm' ? { fontSize: 15 } : null}>
          {formatUSD(usd)}
        </Text>
        {showCompare ? (
          <Text variant="caption" color="textMuted" style={{ textDecorationLine: 'line-through' }} tabular>
            {formatUSD(compareAt)}
          </Text>
        ) : null}
        {showCompare && size === 'lg' && off >= 1 ? <Badge label={`−${off} %`} tone="danger" style={{ alignSelf: 'center' }} /> : null}
      </View>
      {inDivisas && saving >= 0.1 ? (
        <View
          testID="price-divisas"
          accessible
          accessibilityLabel={`${formatUSD(inDivisas)} pagando con ${divisas!.label}, ${String(saving).replace('.', ',')} % menos`}
          style={{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, paddingLeft: 9, paddingRight: 11, paddingVertical: 5, borderRadius: t.radii.pill, backgroundColor: t.colors.successSoft }}
        >
          <Icon name="tag" size={14} color={t.colors.success} strokeWidth={2.2} />
          <Text variant="label" color="success" tabular>
            {formatUSD(inDivisas)} con {divisas!.label}
          </Text>
          <Text variant="caption" color="success" tabular>· {String(saving).replace('.', ',')} % menos</Text>
        </View>
      ) : null}
      {ves && onRatePress ? (
        <ScalePressable testID="price-ves" scaleTo={0.98} accessibilityRole="button" accessibilityLabel={`${ves}. Ver de dónde sale la tasa`} hitSlop={8} onPress={onRatePress} style={{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          <Text variant="caption" color="textMuted" tabular>{ves}</Text>
          <Icon name="info" size={13} color={t.colors.textMuted} />
        </ScalePressable>
      ) : ves ? (
        <Text variant="caption" color="textMuted" tabular>{ves}</Text>
      ) : null}
    </View>
  );
}
