import { addressSchema, type AddressInput } from '@kora/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Switch, View } from 'react-native';
import { OptionsSheet } from '@/components/catalog/Catalog';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { ScalePressable } from '@/components/ui/Pressable';
import { Banner } from '@/components/ui/States';
import { Text } from '@/components/ui/Text';
import { TextField } from '@/components/ui/TextField';
import { useAuth } from '@/lib/auth';
import { useAddresses } from '@/lib/hooks';
import { qk } from '@/lib/query';
import { api } from '@/lib/supabase';
import { useTheme } from '@/theme';

type Form = { [K in Exclude<keyof AddressInput, 'is_default'>]-?: string } & { is_default: boolean };
const EMPTY: Form = { label: 'Casa', recipient: '', phone: '', region_code: '', city: '', municipality: '', line1: '', reference: '', id_document: '', is_default: false };

export default function EditAddressScreen() {
  const { id } = useLocalSearchParams<{ id?: string; from?: string }>();
  const t = useTheme();
  const qc = useQueryClient();
  const { user } = useAuth();
  const addresses = useAddresses();
  const regions = useQuery({ queryKey: ['regions'], queryFn: () => api.account.regions(), staleTime: Infinity });
  const [f, setF] = useState<Form>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [regionSheet, setRegionSheet] = useState(false);

  // load the saved address once; a background refetch must not overwrite what the buyer is typing
  const [loadedId, setLoadedId] = useState<string | null>(null);
  const saved = addresses.data?.find((x) => x.id === id);
  if (saved && loadedId !== saved.id) {
    setLoadedId(saved.id);
    setF({ label: saved.label, recipient: saved.recipient, phone: saved.phone, region_code: saved.region_code, city: saved.city, municipality: saved.municipality ?? '', line1: saved.line1, reference: saved.reference ?? '', id_document: saved.id_document ?? '', is_default: saved.is_default } as Form);
  }

  const save = useMutation({
    mutationFn: async () => {
      const parsed = addressSchema.safeParse(f);
      if (!parsed.success) {
        setErrors(Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])));
        throw new Error('Revisa los campos marcados.');
      }
      setErrors({});
      const v = parsed.data;
      return api.account.saveAddress({ ...(id ? { id } : {}), user_id: user!.id, ...v, municipality: v.municipality || null, reference: v.reference || null, id_document: v.id_document ? v.id_document.toUpperCase() : null, country_code: 'VE' });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.addresses });
      qc.invalidateQueries({ queryKey: ['checkout'] });
      router.back();
    },
  });

  const set = (k: keyof Form) => (v: string) => setF((x) => ({ ...x, [k]: v }));
  const region = regions.data?.find((r) => r.code === f.region_code);

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: t.colors.background }}>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 48, width: '100%', maxWidth: 560, alignSelf: 'center' }} keyboardShouldPersistTaps="handled">
        {save.error ? <Banner tone="danger" icon="circle-alert" body={(save.error as Error).message} /> : null}
        <TextField testID="addr-label" label="Nombre de la dirección" value={f.label} onChangeText={set('label')} error={errors.label} placeholder="Casa, Oficina…" />
        <TextField testID="addr-recipient" label="Quién recibe" value={f.recipient} onChangeText={set('recipient')} error={errors.recipient} autoComplete="name" />
        <TextField testID="addr-phone" label="Teléfono" value={f.phone} onChangeText={set('phone')} error={errors.phone} keyboardType="phone-pad" placeholder="0412 123 4567" autoComplete="tel" />
        <View style={{ gap: 6 }}>
          <Text variant="label" color="textSecondary">Estado</Text>
          <ScalePressable testID="addr-region" scaleTo={0.99} accessibilityRole="button" onPress={() => setRegionSheet(true)} style={{ minHeight: 50, borderRadius: t.radii.md, borderWidth: errors.region_code ? 1.5 : 1, borderColor: errors.region_code ? t.colors.danger : t.colors.border, backgroundColor: t.colors.surface, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14 }}>
            <Text style={{ flex: 1 }} color={region ? 'text' : 'textMuted'}>{region?.name ?? 'Elige el estado'}</Text>
            <Icon name="chevron-down" size={18} color={t.colors.textMuted} />
          </ScalePressable>
          {errors.region_code ? <Text variant="caption" color="danger">{errors.region_code}</Text> : null}
        </View>
        <TextField testID="addr-city" label="Ciudad" value={f.city} onChangeText={set('city')} error={errors.city} />
        <TextField label="Municipio (opcional)" value={f.municipality} onChangeText={set('municipality')} />
        <TextField testID="addr-line1" label="Dirección" value={f.line1} onChangeText={set('line1')} error={errors.line1} placeholder="Avenida, calle, edificio, piso, apartamento" multiline />
        <TextField label="Punto de referencia (opcional)" value={f.reference} onChangeText={set('reference')} />
        <TextField label="Cédula o RIF de quien recibe (opcional)" value={f.id_document} onChangeText={set('id_document')} error={errors.id_document} autoCapitalize="characters" helper="Algunas empresas de envío la piden al retirar." />
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text>Usar como dirección principal</Text>
          <Switch value={f.is_default} onValueChange={(v) => setF((x) => ({ ...x, is_default: v }))} trackColor={{ true: t.colors.brand, false: t.colors.borderStrong }} />
        </View>
        <Button testID="addr-save" title="Guardar dirección" size="lg" full loading={save.isPending} onPress={() => save.mutate()} />
      </ScrollView>
      <OptionsSheet
        visible={regionSheet}
        title="Estado"
        options={(regions.data ?? []).map((r) => ({ key: r.code, label: r.name, selected: r.code === f.region_code }))}
        onSelect={(k) => { setF((x) => ({ ...x, region_code: k })); setRegionSheet(false); }}
        onClose={() => setRegionSheet(false)}
      />
    </KeyboardAvoidingView>
  );
}
