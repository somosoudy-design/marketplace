import { newIdempotencyKey } from '@kora/api';
import { STORE_STATUS_LABEL } from '@kora/core';
import { storeAccents } from '@kora/design-tokens';
import { useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { AdvancedPanel, SellerScreen, SellerScroll } from '@/components/seller/SellerScreen';
import { IMAGE_TYPES, imageBytes, pickSellerImage, SellerImage, type PickedImage } from '@/components/seller/SellerImage';
import { UnsavedChanges } from '@/components/seller/UnsavedChanges';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Layout';
import { Banner } from '@/components/ui/States';
import { Text } from '@/components/ui/Text';
import { TextField } from '@/components/ui/TextField';
import { haptics } from '@/lib/haptics';
import { useAuth } from '@/lib/auth';
import { useSeller } from '@/lib/seller';
import { api, storeImage } from '@/lib/supabase';

export default function SellerSettingsScreen() { return <SellerScreen><Settings /></SellerScreen>; }
const accents = { jade: 'Jade', amber: 'Ámbar', coral: 'Coral', plum: 'Ciruela', ink: 'Tinta', sky: 'Cielo' };
function Settings() {
  const { store, access } = useSeller();
  const s = store!;
  const qc = useQueryClient();
  const { user } = useAuth();
  const policies = s.policies && typeof s.policies === 'object' && !Array.isArray(s.policies) ? s.policies : {};
  const initial = { name: s.name, tagline: s.tagline ?? '', description: s.description ?? '', contact_email: s.contact_email ?? '', shipping_info: s.shipping_info ?? '', returns: String(policies.returns ?? ''), warranty: String(policies.warranty ?? ''), accent: s.accent ?? 'jade' };
  const [f, setF] = useState(initial);
  const [baseline, setBaseline] = useState(JSON.stringify(initial));
  const [images, setImages] = useState<{ logo?: PickedImage; cover?: PickedImage }>({});
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const dirty = JSON.stringify(f) !== baseline || !!images.logo || !!images.cover;
  const nameError = f.name.trim().length < 2 ? 'Entre 2 y 60 caracteres.' : null;
  const emailError = f.contact_email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.contact_email.trim()) ? 'Escribe un correo válido.' : null;
  const change = (key: keyof typeof f, value: string) => { setF((old) => ({ ...old, [key]: value })); setSaved(false); };
  const pick = async (key: 'logo' | 'cover') => {
    try { const image = await pickSellerImage(key === 'logo' ? [1, 1] : [16, 9]); if (image) { setImages((old) => ({ ...old, [key]: image })); setSaved(false); setError(null); } }
    catch (e) { setError((e as Error).message); }
  };
  const save = async () => {
    if (lock.current || nameError || emailError || !dirty) return;
    lock.current = true; setBusy(true); setError(null); setSaved(false);
    try {
      const paths = { logo_path: s.logo_path, cover_path: s.cover_path };
      for (const key of ['logo', 'cover'] as const) {
        const image = images[key]; if (!image) continue;
        // Retain successfully uploaded paths if saving another image or the profile fails: retry won't upload twice.
        image.uploaded ??= await api.seller.uploadImage('stores', `${s.id}/${newIdempotencyKey(key)}.${IMAGE_TYPES[image.type]}`, await imageBytes(image), image.type);
        paths[`${key}_path`] = image.uploaded;
      }
      const updated = await api.seller.updateStore(s.id, { name: f.name.trim(), tagline: f.tagline.trim() || null, description: f.description.trim() || null,
        contact_email: f.contact_email.trim() || null, shipping_info: f.shipping_info.trim() || null, accent: f.accent,
        policies: { ...policies, returns: f.returns.trim(), warranty: f.warranty.trim() }, ...paths });
      qc.setQueryData(['seller-access', user!.id], { ...access.data!, stores: access.data!.stores.map((old) => old.id === updated.id ? updated : old) });
      await Promise.all([qc.invalidateQueries({ queryKey: ['store'] }), qc.invalidateQueries({ queryKey: ['home'] }), qc.invalidateQueries({ queryKey: ['search'] }), qc.invalidateQueries({ queryKey: ['product'] })]);
      setF((old) => ({ ...old, name: updated.name })); setBaseline(JSON.stringify({ ...f, name: updated.name })); setImages({}); setSaved(true); haptics.success();
    } catch (e) { setError((e as Error).message || 'No pudimos guardar. Revisa tu conexión e intenta de nuevo.'); }
    finally { lock.current = false; setBusy(false); }
  };
  return <><UnsavedChanges dirty={dirty} busy={busy} /><SellerScroll>
    <Text variant="title">Perfil de tu tienda</Text><Text color="textSecondary">Estos datos se muestran en tu página pública. Guarda cuando termines.</Text>
    <Card style={{ gap: 16 }}><Text variant="subtitle">Identidad y contacto</Text>
      <TextField testID="store-name" label="Nombre comercial" value={f.name} maxLength={60} error={nameError} editable={!busy} onChangeText={(v) => change('name', v)} />
      <TextField testID="store-tagline" label="Frase corta" value={f.tagline} maxLength={90} editable={!busy} onChangeText={(v) => change('tagline', v)} />
      <TextField testID="store-description" label="Descripción" value={f.description} multiline maxLength={2000} editable={!busy} onChangeText={(v) => change('description', v)} />
      <TextField testID="store-email" label="Correo de contacto" value={f.contact_email} keyboardType="email-address" autoCapitalize="none" error={emailError} editable={!busy} onChangeText={(v) => change('contact_email', v)} />
    </Card>
    <Card style={{ gap: 16 }}><SellerImage label="Portada" aspect={16 / 9} uri={images.cover?.uri ?? storeImage(s.cover_path)} disabled={busy} onPick={() => pick('cover')} /><SellerImage label="Logotipo" uri={images.logo?.uri ?? storeImage(s.logo_path)} disabled={busy} onPick={() => pick('logo')} /></Card>
    <Card style={{ gap: 16 }}><Text variant="subtitle">Envíos y políticas</Text>
      <TextField testID="store-shipping" label="Información de envíos" value={f.shipping_info} multiline editable={!busy} onChangeText={(v) => change('shipping_info', v)} />
      <TextField testID="store-returns" label="Cambios y devoluciones" value={f.returns} multiline editable={!busy} onChangeText={(v) => change('returns', v)} />
      <TextField testID="store-warranty" label="Garantía" value={f.warranty} multiline editable={!busy} onChangeText={(v) => change('warranty', v)} />
    </Card>
    <Card style={{ gap: 12 }}><Text variant="subtitle">Color de acento</Text>{(Object.keys(storeAccents) as (keyof typeof accents)[]).map((a) => <Button key={a} title={accents[a]} variant={f.accent === a ? 'primary' : 'secondary'} disabled={busy} onPress={() => change('accent', a)} />)}</Card>
    <Text variant="bodySmall" color="textSecondary">Estado: {STORE_STATUS_LABEL[s.status]}. La dirección y la aprobación las administra HAYAZGO.</Text>
    {dirty ? <Text testID="store-dirty" color="textSecondary">Cambios sin guardar</Text> : null}
    {error ? <Banner tone="danger" body={error} /> : null}
    {saved ? <Banner tone="success" body="Perfil guardado. Los datos de tu tienda quedaron actualizados." /> : null}
    <Button testID="store-save" title={error ? 'Reintentar guardado' : 'Guardar cambios'} full loading={busy} disabled={!dirty || !!nameError || !!emailError} onPress={save} />
    <AdvancedPanel path="/vendedor/tienda" />
  </SellerScroll></>;
}
