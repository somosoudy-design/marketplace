import { STORE_STATUS_LABEL } from '@kora/core';
import { View } from 'react-native';
import { AdvancedPanel, SellerScreen, SellerScroll } from '@/components/seller/SellerScreen';
import { Card } from '@/components/ui/Layout';
import { Text } from '@/components/ui/Text';
import { useSeller } from '@/lib/seller';

export default function SellerSettingsScreen() { return <SellerScreen><Settings /></SellerScreen>; }

function Settings() {
  const { store, access } = useSeller();
  const s = store!;
  const policies = s.policies && typeof s.policies === 'object' && !Array.isArray(s.policies) ? Object.entries(s.policies).filter(([, value]) => typeof value === 'string') : [];
  return <SellerScroll refresh={() => access.refetch()} refreshing={access.isFetching}>
    <Text variant="title">{s.name}</Text><Text color="textSecondary">Consulta los datos de tu tienda. Para editarlos, abre el panel web.</Text>
    <Card style={{ gap: 16 }}><Field label="Nombre" value={s.name} /><Field label="Estado" value={STORE_STATUS_LABEL[s.status] ?? null} /><Field label="Correo de contacto" value={s.contact_email} /><Field label="Descripción" value={s.description} /><Field label="Información de envíos" value={s.shipping_info} /></Card>
    <Card style={{ gap: 12 }}><Text variant="subtitle">Políticas de la tienda</Text>{policies.length ? policies.map(([key, value]) => <Field key={key} label={key === 'returns' ? 'Devoluciones' : key === 'warranty' ? 'Garantía' : key} value={String(value)} />) : <Text variant="bodySmall" color="textSecondary">Aún no hay políticas registradas.</Text>}</Card>
    <AdvancedPanel path="/vendedor/tienda" />
  </SellerScroll>;
}

function Field({ label, value }: { label: string; value: string | null }) {
  return <View style={{ gap: 4 }}><Text variant="caption" color="textMuted">{label}</Text><Text>{value?.trim() || 'Sin registrar'}</Text></View>;
}
