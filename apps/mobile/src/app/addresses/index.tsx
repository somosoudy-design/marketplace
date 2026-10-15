import { router } from 'expo-router';
import { ScrollView, View } from 'react-native';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { ScalePressable } from '@/components/ui/Pressable';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState, OfflineState, waitingForNetwork } from '@/components/ui/States';
import { Text } from '@/components/ui/Text';
import { useAddresses } from '@/lib/hooks';
import { useTheme } from '@/theme';

export default function AddressesScreen() {
  const t = useTheme();
  const addresses = useAddresses();

  if (addresses.isError && !addresses.data) return <ErrorState error={addresses.error} onRetry={() => addresses.refetch()} />;
  if (waitingForNetwork(addresses)) return <OfflineState />;
  return (
    <ScrollView style={{ backgroundColor: t.colors.background }} contentContainerStyle={{ padding: 16, gap: 12, width: '100%', maxWidth: 720, alignSelf: 'center' }}>
      {addresses.isLoading ? [0, 1].map((i) => <Skeleton key={i} height={90} radius={t.radii.lg} />) : null}
      {addresses.data?.length === 0 ? <EmptyState icon="map-pin" title="Sin direcciones guardadas" body="Agrega dónde quieres recibir tus compras." /> : null}
      {addresses.data?.map((a) => (
        <ScalePressable
          key={a.id}
          testID={`addr-row-${a.id}`}
          scaleTo={0.99}
          accessibilityRole="button"
          accessibilityLabel={`${a.label}${a.is_default ? ', principal' : ''}. ${a.line1}, ${a.city}. Editar`}
          onPress={() => router.push({ pathname: '/addresses/edit', params: { id: a.id } })}
          style={{ flexDirection: 'row', gap: 12, alignItems: 'center', padding: 16, borderRadius: t.radii.lg, borderWidth: 1, borderColor: t.colors.border, backgroundColor: t.colors.surface }}
        >
          <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: t.colors.brandSoft, alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-start' }}>
            <Icon name={a.label === 'Oficina' ? 'store' : a.label === 'Casa' ? 'house' : 'map-pin'} size={19} color={t.colors.brand} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
              <Text variant="label">{a.label}</Text>
              {a.is_default ? <Badge label="Principal" tone="brand" /> : null}
            </View>
            <Text variant="bodySmall" color="textSecondary" numberOfLines={2}>{a.line1}, {a.city}</Text>
            <Text variant="caption" color="textMuted">{a.recipient} · {a.phone}</Text>
          </View>
          <Icon name="chevron-right" size={18} color={t.colors.textMuted} />
        </ScalePressable>
      ))}
      <Button testID="address-add" title="Agregar dirección" icon="plus" variant={addresses.data?.length ? 'secondary' : 'primary'} onPress={() => router.push('/addresses/edit')} />
    </ScrollView>
  );
}
