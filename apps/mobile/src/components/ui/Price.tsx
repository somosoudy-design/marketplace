import { formatUSD, formatVES, D } from '@kora/core';
import { View } from 'react-native';
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
}

/**
 * The main price is in dollars at the BCV rate; the VES line converts it at today's rate and the divisas line says
 * what Zelle/USDT pay with today's gap (docs/PRECIOS.md). Both are references: the quote at payment decides.
 */
export function Price({ usd, compareAt, size = 'md', vesRate, divisas, muted }: Props) {
  const showCompare = compareAt != null && D(compareAt).gt(usd);
  const inDivisas = divisas && divisas.best < 1 ? D(usd).times(divisas.best) : null;
  const saving = inDivisas ? D(1).minus(divisas!.best).times(100).toDecimalPlaces(1).toNumber() : 0;
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
      {inDivisas && saving >= 0.1 ? (
        <Text variant="caption" color="success" tabular testID="price-divisas">
          {formatUSD(inDivisas)} con {divisas!.label} · {String(saving).replace('.', ',')} % menos
        </Text>
      ) : null}
    </View>
  );
}
