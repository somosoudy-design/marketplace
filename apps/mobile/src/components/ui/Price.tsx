import { formatUSD, formatVES, D } from '@kora/core';
import { View } from 'react-native';
import { Text } from './Text';

interface Props {
  usd: number | string;
  compareAt?: number | string | null;
  size?: 'sm' | 'md' | 'lg';
  /** Reference rate (USD/VES) to show the bolívar equivalent. Omitted when no current rate is available. */
  vesRate?: { rate: number; demo: boolean } | null;
  muted?: boolean;
}

/** USD is the reference currency; the VES line is a reference at the current rate, never a frozen price. */
export function Price({ usd, compareAt, size = 'md', vesRate, muted }: Props) {
  const showCompare = compareAt != null && D(compareAt).gt(usd);
  return (
    <View accessible accessibilityLabel={`Precio ${formatUSD(usd)}${showCompare ? `, antes ${formatUSD(compareAt)}` : ''}`}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
        <Text variant={size === 'lg' ? 'priceLarge' : 'price'} color={muted ? 'textMuted' : 'text'} tabular style={size === 'sm' ? { fontSize: 15 } : null}>
          {formatUSD(usd)}
        </Text>
        {showCompare ? (
          <Text variant="caption" color="textMuted" style={{ textDecorationLine: 'line-through' }} tabular>
            {formatUSD(compareAt)}
          </Text>
        ) : null}
      </View>
      {vesRate ? (
        <Text variant="caption" color="textMuted" tabular>
          ≈ {formatVES(D(usd).times(vesRate.rate))} {vesRate.demo ? 'con tasa de demostración' : 'a la tasa de hoy'}
        </Text>
      ) : null}
    </View>
  );
}
