import { addressSchema, type AddressInput } from '@kora/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { OptionsSheet } from '@/components/catalog/Catalog';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Icon } from '@/components/ui/Icon';
import { ScalePressable } from '@/components/ui/Pressable';
import { Sheet } from '@/components/ui/Sheet';
import { Banner } from '@/components/ui/States';
import { Text } from '@/components/ui/Text';
import { TextField } from '@/components/ui/TextField';
import { useAuth } from '@/lib/auth';
import { haptics } from '@/lib/haptics';
import { useAddresses } from '@/lib/hooks';
import { qk } from '@/lib/query';
import { api } from '@/lib/supabase';
import { useTheme } from '@/theme';

type Form = { [K in Exclude<keyof AddressInput, 'is_default'>]-?: string } & { is_default: boolean };
const EMPTY: Form = { label: 'Casa', recipient: '', phone: '', region_code: '', city: '', municipality: '', line1: '', reference: '', id_document: '', is_default: false };
const LABELS = ['Casa', 'Oficina'];

export default function EditAddressScreen() {
  const { id } = useLocalSearchParams<{ id?: string; from?: string }>();
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const { user } = useAuth();
  const addresses = useAddresses();
  const regions = useQuery({ queryKey: ['regions'], queryFn: () => api.account.regions(), staleTime: Infinity });
  const [f, setF] = useState<Form>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [regionSheet, setRegionSheet] = useState(false);
  const [more, setMore] = useState(false);
  const [customLabel, setCustomLabel] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const cities = useQuery({ queryKey: ['cities', f.region_code], queryFn: () => api.account.cities(f.region_code), enabled: !!f.region_code, staleTime: Infinity });

  // load the saved address once; a background refetch must not overwrite what the buyer is typing
  const [loadedId, setLoadedId] = useState<string | null>(null);
  const saved = addresses.data?.find((x) => x.id === id);
  if (saved && loadedId !== saved.id) {
    setLoadedId(saved.id);
    setF({ label: saved.label, recipient: saved.recipient, phone: saved.phone, region_code: saved.region_code, city: saved.city, municipality: saved.municipality ?? '', line1: saved.line1, reference: saved.reference ?? '', id_document: saved.id_document ?? '', is_default: saved.is_default } as Form);
    setMore(!!(saved.municipality || saved.reference || saved.id_document));
    setCustomLabel(!LABELS.includes(saved.label));
  }
  // the first address is the main one; the switch only appears when there is a choice to make
  const first = addresses.isSuccess && addresses.data.filter((a) => a.id !== id).length === 0;

  const save = useMutation({
    mutationFn: async () => {
      const parsed = addressSchema.safeParse(f);
      if (!parsed.success) {
        const errs = Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message]));
        setErrors(errs);
        if (errs.id_document || errs.municipality || errs.reference) setMore(true);
        scrollRef.current?.scrollTo({ y: 0, animated: true });
        throw new Error('Revisa los campos marcados.');
      }
      setErrors({});
      const v = parsed.data;
      return api.account.saveAddress({
        ...(id ? { id } : {}),
        user_id: user!.id,
        ...v,
        is_default: first ? true : !!v.is_default,
        municipality: v.municipality || null,
        reference: v.reference || null,
        id_document: v.id_document ? v.id_document.toUpperCase() : null,
        country_code: 'VE',
      });
    },
    onSuccess: () => {
      haptics.success();
      qc.invalidateQueries({ queryKey: qk.addresses });
      qc.invalidateQueries({ queryKey: ['checkout'] });
      router.back();
    },
    onError: () => haptics.warning(),
  });

  const remove = useMutation({
    mutationFn: () => api.account.deleteAddress(id!),
    onSuccess: () => {
      haptics.success();
      setConfirmDelete(false);
      qc.invalidateQueries({ queryKey: qk.addresses });
      qc.invalidateQueries({ queryKey: ['checkout'] });
      router.back();
    },
    onError: () => haptics.warning(),
  });

  const set = (k: keyof Form) => (v: string) => {
    setF((x) => ({ ...x, [k]: v }));
    if (errors[k]) setErrors((e) => ({ ...e, [k]: '' }));
  };
  const region = regions.data?.find((r) => r.code === f.region_code);
  const typed = f.city.trim().toLowerCase();
  const suggestions = (cities.data ?? []).filter((c) => c.name.toLowerCase() !== typed && (!typed || c.name.toLowerCase().includes(typed))).slice(0, 6);

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: t.colors.background }}>
      <ScrollView ref={scrollRef} contentContainerStyle={{ padding: 20, gap: 28, paddingBottom: 32, width: '100%', maxWidth: 560, alignSelf: 'center' }} keyboardShouldPersistTaps="handled">
        {save.error ? <Banner tone="danger" icon="circle-alert" body={(save.error as Error).message} /> : null}

        <Section title="Quién recibe">
          <TextField testID="addr-recipient" label="Nombre y apellido" value={f.recipient} onChangeText={set('recipient')} error={errors.recipient} autoComplete="name" textContentType="name" />
          <TextField testID="addr-phone" label="Teléfono" value={f.phone} onChangeText={set('phone')} error={errors.phone} keyboardType="phone-pad" placeholder="0412 123 4567" autoComplete="tel" textContentType="telephoneNumber" helper="La empresa de envío lo usa para coordinar la entrega." />
        </Section>

        <Section title="Dónde">
          <View style={{ gap: 6 }}>
            <Text variant="label" color="textSecondary">Estado</Text>
            <ScalePressable testID="addr-region" scaleTo={0.99} accessibilityRole="button" accessibilityLabel={region ? `Estado: ${region.name}. Cambiar` : 'Elegir estado'} onPress={() => setRegionSheet(true)} style={{ minHeight: 50, borderRadius: t.radii.md, borderWidth: errors.region_code ? 1.5 : 1, borderColor: errors.region_code ? t.colors.danger : t.colors.border, backgroundColor: t.colors.surface, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14 }}>
              <Text style={{ flex: 1 }} color={region ? 'text' : 'textMuted'}>{region?.name ?? 'Elige el estado'}</Text>
              <Icon name="chevron-down" size={18} color={t.colors.textMuted} />
            </ScalePressable>
            {errors.region_code ? <Text variant="caption" color="danger">{errors.region_code}</Text> : null}
          </View>
          <View style={{ gap: 8 }}>
            <TextField testID="addr-city" label="Ciudad" value={f.city} onChangeText={set('city')} error={errors.city} textContentType="addressCity" placeholder={region ? undefined : 'Elige primero el estado'} />
            {suggestions.length ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 8 }} testID="addr-city-suggestions">
                {suggestions.map((c) => (
                  <Chip key={c.id} testID={`addr-city-${c.name}`} label={c.name} onPress={() => { haptics.select(); set('city')(c.name); }} />
                ))}
              </ScrollView>
            ) : null}
          </View>
          <TextField testID="addr-line1" label="Dirección" value={f.line1} onChangeText={set('line1')} error={errors.line1} placeholder="Avenida o calle, edificio o casa, piso y número" multiline autoComplete="street-address" textContentType="fullStreetAddress" />

          {more ? (
            <View style={{ gap: 16 }}>
              <TextField testID="addr-reference" label="Punto de referencia" value={f.reference} onChangeText={set('reference')} placeholder="Frente a la plaza, al lado de la farmacia…" />
              <TextField testID="addr-municipality" label="Municipio" value={f.municipality} onChangeText={set('municipality')} />
              <TextField testID="addr-id" label="Cédula o RIF de quien recibe" value={f.id_document} onChangeText={set('id_document')} error={errors.id_document} autoCapitalize="characters" placeholder="V-12345678" helper="Algunas empresas de envío la piden al retirar en oficina." />
            </View>
          ) : (
            <ScalePressable testID="addr-more" accessibilityRole="button" onPress={() => setMore(true)} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', paddingVertical: 4 }}>
              <Icon name="plus" size={16} color={t.colors.brand} />
              <Text variant="label" color="brand">Agregar referencia, municipio o cédula</Text>
            </ScalePressable>
          )}
        </Section>

        <Section title="Guárdala como">
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            {LABELS.map((l) => (
              <Chip key={l} testID={`addr-label-${l}`} label={l} icon={l === 'Casa' ? 'house' : 'store'} selected={!customLabel && f.label === l} onPress={() => { setCustomLabel(false); set('label')(l); }} />
            ))}
            <Chip testID="addr-label-other" label="Otro" selected={customLabel} onPress={() => { setCustomLabel(true); set('label')(LABELS.includes(f.label) ? '' : f.label); }} />
          </View>
          {customLabel ? <TextField testID="addr-label" label="Nombre" value={f.label} onChangeText={set('label')} error={errors.label} placeholder="Casa de mi mamá, Consultorio…" autoFocus /> : null}
          {errors.label && !customLabel ? <Text variant="caption" color="danger">{errors.label}</Text> : null}
          {!first ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Text>Usar como dirección principal</Text>
                <Text variant="caption" color="textMuted">La elegimos primero al comprar.</Text>
              </View>
              <Switch testID="addr-default" value={f.is_default} onValueChange={(v) => setF((x) => ({ ...x, is_default: v }))} trackColor={{ true: t.colors.brand, false: t.colors.borderStrong }} />
            </View>
          ) : null}
        </Section>

        {id && saved ? (
          <Button testID="addr-delete" title="Eliminar esta dirección" icon="trash" variant="danger" onPress={() => setConfirmDelete(true)} />
        ) : null}
      </ScrollView>

      <View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: insets.bottom + 12, backgroundColor: t.colors.chrome, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.colors.borderStrong }}>
        <View style={{ width: '100%', maxWidth: 520, alignSelf: 'center' }}>
          <Button testID="addr-save" title={id ? 'Guardar cambios' : 'Guardar dirección'} size="lg" full loading={save.isPending} onPress={() => save.mutate()} />
        </View>
      </View>

      <Sheet
        visible={confirmDelete}
        title={`¿Eliminar «${saved?.label ?? 'esta dirección'}»?`}
        onClose={() => setConfirmDelete(false)}
        footer={
          <>
            <Button testID="addr-delete-confirm" title="Eliminar" variant="danger" full loading={remove.isPending} onPress={() => remove.mutate()} />
            <Button title="Conservarla" variant="ghost" full onPress={() => setConfirmDelete(false)} />
          </>
        }
      >
        <View style={{ gap: 12 }}>
          <Text color="textSecondary">
            Tus pedidos ya hechos no cambian: guardan la dirección con la que se compraron.
            {saved?.is_default && (addresses.data?.length ?? 0) > 1 ? ' La dirección que agregaste más recientemente pasa a ser la principal.' : ''}
          </Text>
          {remove.error ? <Banner tone="danger" icon="circle-alert" body={(remove.error as Error).message} /> : null}
        </View>
      </Sheet>

      <OptionsSheet
        visible={regionSheet}
        title="Estado"
        options={(regions.data ?? []).map((r) => ({ key: r.code, label: r.name, selected: r.code === f.region_code }))}
        onSelect={(k) => {
          // a city typed for another state is almost certainly wrong now
          setF((x) => ({ ...x, region_code: k, city: x.region_code && x.region_code !== k ? '' : x.city }));
          setErrors((e) => ({ ...e, region_code: '' }));
          setRegionSheet(false);
        }}
        onClose={() => setRegionSheet(false)}
      />
    </KeyboardAvoidingView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 14 }}>
      <Text variant="title" accessibilityRole="header">{title}</Text>
      {children}
    </View>
  );
}
