import type { RateStatus } from '@kora/api';
import { formatRate } from '@kora/core';
import { useState } from 'react';
import { View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Divider } from '@/components/ui/Layout';
import { ScalePressable } from '@/components/ui/Pressable';
import { Sheet } from '@/components/ui/Sheet';
import { Skeleton } from '@/components/ui/Skeleton';
import { Banner } from '@/components/ui/States';
import { Text } from '@/components/ui/Text';
import { SOURCE_LABEL, shortDateTime, timeAgo } from '@/lib/format';
import { useDivisas, useRateStatus } from '@/lib/hooks';
import { useTheme } from '@/theme';

const SHORT: Record<string, string> = { bcv_official: 'BCV', dolarapi_oficial: 'BCV', manual: 'Tasa fijada', demo: 'Tasa demo' };

/** Compact rate line that opens a sheet explaining where the bolívar figure comes from and when it applies. */
export function RatePill({ testID = 'home-rate' }: { testID?: string }) {
  const t = useTheme();
  const [open, setOpen] = useState(false);
  const q = useRateStatus();
  const r = q.data;
  if (!r) return q.isLoading ? <Skeleton width={190} height={30} radius={15} /> : null;
  const ok = r.available;
  const demo = ok && r.source === 'demo';
  const label = ok ? `${SHORT[r.source] ?? SOURCE_LABEL[r.source] ?? r.source} · ${formatRate(r.rate)}` : 'Tasa del día no disponible';
  return (
    <>
      <ScalePressable
        testID={testID}
        scaleTo={0.97}
        accessibilityRole="button"
        accessibilityLabel={`${label}. Ver detalles de la tasa`}
        onPress={() => setOpen(true)}
        style={{
          alignSelf: 'flex-start',
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          height: 30,
          paddingLeft: 10,
          paddingRight: 8,
          borderRadius: 15,
          backgroundColor: ok ? (demo ? t.colors.accentSoft : t.colors.surface) : t.colors.warningSoft,
          borderWidth: ok && !demo ? 1 : 0,
          borderColor: t.colors.border,
        }}
      >
        <Icon name={ok ? 'landmark' : 'circle-alert'} size={14} color={ok ? t.colors.textSecondary : t.colors.warning} />
        <Text variant="caption" color={ok ? 'textSecondary' : 'warning'} tabular numberOfLines={1} style={{ fontFamily: 'PlusJakartaSans_600SemiBold' }}>{label}</Text>
        <Icon name="chevron-right" size={14} color={t.colors.textMuted} />
      </ScalePressable>
      <RateSheet rate={r} visible={open} onClose={() => setOpen(false)} />
    </>
  );
}

export function RateSheet({ rate: r, visible, onClose }: { rate: RateStatus; visible: boolean; onClose: () => void }) {
  const t = useTheme();
  const divisas = useDivisas();
  const saving = divisas && divisas.best < 1 ? (1 - divisas.best) * 100 : 0;
  const margin = r.available && Number(r.base) > 0 ? (Number(r.rate) / Number(r.base) - 1) * 100 : 0;
  return (
    <Sheet visible={visible} title="Precios y tasa de cambio" onClose={onClose} testID="rate-sheet" footer={<Button title="Entendido" variant="secondary" full onPress={onClose} />}>
      <View style={{ gap: 18 }}>
        {r.available ? (
          <>
            <View style={{ gap: 2 }}>
              <Text variant="displayL" tabular>{formatRate(r.rate).replace(' por USD', '')}</Text>
              <Text variant="caption" color="textMuted">por cada dólar, para pagos en bolívares</Text>
            </View>
            <View style={{ borderRadius: t.radii.lg, borderWidth: 1, borderColor: t.colors.border, overflow: 'hidden' }}>
              <Fact label="Fuente" value={SOURCE_LABEL[r.source] ?? r.source} />
              <Divider />
              <Fact label="Actualizada" value={`${shortDateTime(r.observed_at)} · ${timeAgo(r.observed_at)}`} />
              {Math.abs(margin) >= 0.005 ? (
                <>
                  <Divider />
                  <Fact label="Tasa de la fuente" value={`${formatRate(r.base).replace(' por USD', '')} · ajuste ${margin.toFixed(2).replace('.', ',')} %`} />
                </>
              ) : null}
            </View>
            {r.source === 'demo' ? (
              <Banner tone="warning" body="Es una tasa de demostración para pruebas. No corresponde a la tasa oficial de hoy." />
            ) : r.is_fallback ? (
              <Banner tone="info" body="La fuente principal no respondió a tiempo; se usa la siguiente fuente configurada." />
            ) : null}
          </>
        ) : (
          <>
            <Banner tone="warning" icon="circle-alert" title="Sin una tasa reciente y verificada" body="No usamos tasas vencidas sin control. El pago en bolívares se habilita en cuanto la tasa se actualice; mientras tanto puedes pagar con métodos en dólares." />
            {r.last ? (
              <Text variant="caption" color="textMuted">
                Última registrada: {formatRate(r.last.rate)} ({SOURCE_LABEL[r.last.source] ?? r.last.source}, {shortDateTime(r.last.observed_at)}). Solo como referencia.
              </Text>
            ) : null}
          </>
        )}
        <View style={{ gap: 12 }}>
          <Point icon="tag" text="Los precios se publican en dólares (USD)." />
          <Point icon="banknote" text="Si pagas en bolívares, el monto se calcula con la tasa vigente al generar el pago y queda fijo durante el tiempo que te indicamos en ese paso." />
          {saving >= 0.1 ? (
            <Point icon="coins" text={`Con ${divisas!.label} pagas el precio en divisas, hoy al menos ${saving.toFixed(1).replace('.', ',')} % menos: el precio principal sin la diferencia del día entre la tasa BCV y el mercado. El monto exacto lo ves al elegir el método.`} />
          ) : (
            <Point icon="coins" text="En USDT se aplica la tasa USD/USDT de ese momento. Si un método cobra comisión, la ves antes de pagar." />
          )}
        </View>
      </View>
    </Sheet>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingHorizontal: 14, paddingVertical: 12 }}>
      <Text variant="bodySmall" color="textMuted">{label}</Text>
      <Text variant="bodySmall" tabular style={{ flexShrink: 1, textAlign: 'right' }}>{value}</Text>
    </View>
  );
}

function Point({ icon, text }: { icon: 'tag' | 'banknote' | 'coins'; text: string }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
      <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: t.colors.brandSoft, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} size={16} color={t.colors.brand} />
      </View>
      <Text variant="bodySmall" color="textSecondary" style={{ flex: 1, paddingTop: 5 }}>{text}</Text>
    </View>
  );
}
