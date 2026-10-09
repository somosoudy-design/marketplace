import { useMutation, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Alert, Platform, ScrollView, View } from 'react-native';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Card } from '@/components/ui/Layout';
import { ScalePressable } from '@/components/ui/Pressable';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { Text } from '@/components/ui/Text';
import { useAddresses } from '@/lib/hooks';
import { qk } from '@/lib/query';
import { api } from '@/lib/supabase';
import { useTheme } from '@/theme';

export default function AddressesScreen() {
  const t = useTheme();
  const qc = useQueryClient();
  const addresses = useAddresses();
  const remove = useMutation({
    mutationFn: (id: string) => api.account.deleteAddress(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.addresses }),
  });
  const confirmRemove = (id: string) =>
    Platform.OS === 'web'
      ? remove.mutate(id)
      : Alert.alert('¿Eliminar esta dirección?', undefined, [{ text: 'Cancelar', style: 'cancel' }, { text: 'Eliminar', style: 'destructive', onPress: () => remove.mutate(id) }]);

  if (addresses.isError) return <ErrorState onRetry={() => addresses.refetch()} />;
  return (
    <ScrollView style={{ backgroundColor: t.colors.background }} contentContainerStyle={{ padding: 16, gap: 12, width: '100%', maxWidth: 720, alignSelf: 'center' }}>
      {addresses.isLoading ? [0, 1].map((i) => <Skeleton key={i} height={90} radius={t.radii.lg} />) : null}
      {addresses.data?.length === 0 ? <EmptyState icon="map-pin" title="Sin direcciones guardadas" body="Agrega dónde quieres recibir tus compras." /> : null}
      {addresses.data?.map((a) => (
        <Card key={a.id} style={{ flexDirection: 'row', gap: 12 }}>
          <Icon name="map-pin" size={20} color={t.colors.brand} />
          <ScalePressable scaleTo={0.99} style={{ flex: 1, gap: 2 }} accessibilityRole="button" accessibilityLabel={`Editar ${a.label}`} onPress={() => router.push({ pathname: '/addresses/edit', params: { id: a.id } })}>
            <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
              <Text variant="label">{a.label}</Text>
              {a.is_default ? <Badge label="Principal" tone="brand" /> : null}
            </View>
            <Text variant="bodySmall" color="textSecondary">{a.recipient} · {a.phone}</Text>
            <Text variant="bodySmall" color="textSecondary">{a.line1}, {a.city}</Text>
          </ScalePressable>
          <Button title="Eliminar" variant="ghost" size="sm" onPress={() => confirmRemove(a.id)} />
        </Card>
      ))}
      <Button testID="address-add" title="Agregar dirección" icon="plus" onPress={() => router.push('/addresses/edit')} />
    </ScrollView>
  );
}
