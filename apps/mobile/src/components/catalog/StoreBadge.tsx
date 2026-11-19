import { palette } from '@kora/design-tokens';
import { useState } from 'react';
import { View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Button } from '@/components/ui/Button';
import { ScalePressable } from '@/components/ui/Pressable';
import { Sheet } from '@/components/ui/Sheet';
import { Text } from '@/components/ui/Text';
import { brand } from '@/lib/brand';
import { useTheme } from '@/theme';

export type StoreTier = 'official' | 'verified' | 'partner';

/**
 * The badge a store has, from its data. Only "official" can be told today: stores.kind = 'platform' is the store the
 * marketplace runs itself, and sellers can't change their own kind (guard_store_fields). Verified and partner stores
 * need an admin-only field that doesn't exist yet (docs/INSIGNIAS_TIENDAS.md), so no store shows those for now.
 */
export function storeTier(store: { kind?: string | null } | null | undefined): StoreTier | null {
  return store?.kind === 'platform' ? 'official' : null;
}

export const STORE_TIERS: Record<StoreTier, { label: string; body: string }> = {
  official: { label: 'Tienda oficial', body: `La opera directamente ${brand.name}.` },
  verified: { label: 'Tienda verificada', body: `${brand.name} verificó la identidad y los documentos de este vendedor.` },
  partner: { label: 'Tienda asociada', body: `Tiene una relación comercial reconocida con ${brand.name}. No significa que su identidad esté verificada.` },
};

// the icon set's badge-check, drawn as a filled seal
const SEAL = 'M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z';
const CHECK = 'm16 9-5.5 5.5L8 12';

function Seal({ tier, size }: { tier: StoreTier; size: number }) {
  const t = useTheme();
  const fill = tier === 'official' ? palette.amber[400] : tier === 'verified' ? t.colors.brand : t.colors.textMuted;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d={SEAL} fill={fill} stroke={fill} strokeWidth={1.5} strokeLinejoin="round" />
      <Path d={CHECK} fill="none" stroke={t.colors.surface} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

/**
 * Small seal next to a store's name: gold for the official store, violet for verified, grey for partner. With
 * `explain` (the store's own page) a tap says what it means; inside a card that already opens the store it's just
 * the mark.
 */
export function StoreBadge({ tier, size = 16, explain }: { tier: StoreTier | null; size?: number; explain?: boolean }) {
  const [open, setOpen] = useState(false);
  if (!tier) return null;
  const info = STORE_TIERS[tier];
  if (!explain) {
    return (
      <View testID={`store-badge-${tier}`} accessible accessibilityLabel={info.label}>
        <Seal tier={tier} size={size} />
      </View>
    );
  }
  return (
    <>
      <ScalePressable testID={`store-badge-${tier}`} accessibilityRole="button" accessibilityLabel={`${info.label}. Qué significa`} hitSlop={10} onPress={() => setOpen(true)}>
        <Seal tier={tier} size={size} />
      </ScalePressable>
      <Sheet visible={open} title={info.label} onClose={() => setOpen(false)} testID="store-badge-sheet" footer={<Button title="Entendido" variant="secondary" full onPress={() => setOpen(false)} />}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Seal tier={tier} size={28} />
          <Text color="textSecondary" style={{ flex: 1 }}>{info.body}</Text>
        </View>
      </Sheet>
    </>
  );
}
