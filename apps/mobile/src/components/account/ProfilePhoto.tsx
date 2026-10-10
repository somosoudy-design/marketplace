import type { Profile } from '@kora/api';
import { useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { ScalePressable } from '@/components/ui/Pressable';
import { Sheet } from '@/components/ui/Sheet';
import { Text } from '@/components/ui/Text';
import { haptics } from '@/lib/haptics';
import { useAvatarUrl } from '@/lib/hooks';
import { qk } from '@/lib/query';
import { api } from '@/lib/supabase';
import { useTheme } from '@/theme';

/** Same limit and types as the avatars bucket (migration 20261010151906_avatars.sql), checked here first. */
const MAX_BYTES = 3 * 1024 * 1024;
const TYPES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
const TOO_BIG = 'La foto pesa más de 3 MB. Elige otra o recórtala más.';

export function initials(s: string) {
  const parts = s.replace(/@.*/, '').split(/[\s._-]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || 'K';
}

/** The user's photo, or their initials when there is none. `uri` previews a photo that isn't saved yet. */
export function Avatar({ path, uri, name, size = 56 }: { path: string | null; uri?: string; name: string; size?: number }) {
  const t = useTheme();
  const signed = useAvatarUrl(uri ? null : path);
  const src = uri ?? signed.data;
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, overflow: 'hidden', backgroundColor: path || uri ? t.colors.surfaceSunken : t.colors.brand, alignItems: 'center', justifyContent: 'center' }}>
      {src ? (
        <Image testID="avatar-photo" source={uri ? { uri } : { uri: src, cacheKey: path ?? undefined }} style={{ width: size, height: size }} contentFit="cover" transition={150} />
      ) : !path ? (
        <Text variant={size >= 96 ? 'displayL' : 'title'} style={{ color: t.colors.onBrand }}>{initials(name)}</Text>
      ) : null}
    </View>
  );
}

/**
 * The account's photo with a camera mark. Without a photo a tap opens the gallery; with one, a sheet to change it or
 * remove it. A picked photo is previewed and only saved on "Usar esta foto".
 */
export function ProfilePhoto({ userId, name, path }: { userId: string; name: string; path: string | null }) {
  const t = useTheme();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<{ uri: string; type: string } | null>(null);
  const [busy, setBusy] = useState<'save' | 'remove' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    if (busy) return;
    setOpen(false);
    setPicked(null);
    setError(null);
  };

  const pick = async () => {
    setError(null);
    // square crop where the system offers it, and JPEG compression, so the file stays small
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.6 });
    if (r.canceled || !r.assets[0]) return;
    const a = r.assets[0];
    const type = a.mimeType ?? 'image/jpeg';
    setOpen(true);
    if (!TYPES[type]) return setError('Elige una foto en JPG, PNG o WebP.');
    if ((a.fileSize ?? 0) > MAX_BYTES) return setError(TOO_BIG);
    setPicked({ uri: a.uri, type });
  };

  const done = (profile: Profile) => {
    qc.setQueryData(qk.profile, profile);
    haptics.success();
    setOpen(false);
    setPicked(null);
  };

  const save = async () => {
    if (!picked) return;
    setBusy('save');
    setError(null);
    let uploaded: string | null = null;
    try {
      const body = await (await fetch(picked.uri)).arrayBuffer();
      if (body.byteLength > MAX_BYTES) throw new Error(TOO_BIG);
      uploaded = await api.account.uploadAvatar(userId, body, picked.type, TYPES[picked.type]);
      done(await api.account.setAvatar(userId, uploaded, path));
    } catch (e) {
      if (uploaded) await api.account.discardAvatar(uploaded).catch(() => undefined);
      setError((e as Error).message === TOO_BIG ? TOO_BIG : 'No pudimos guardar la foto. Revisa tu conexión e intenta de nuevo.');
      haptics.warning();
    } finally {
      setBusy(null);
    }
  };

  const remove = async () => {
    setBusy('remove');
    setError(null);
    try {
      done(await api.account.setAvatar(userId, null, path));
    } catch {
      setError('No pudimos quitar la foto. Revisa tu conexión e intenta de nuevo.');
      haptics.warning();
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <ScalePressable
        testID="account-photo"
        accessibilityRole="button"
        accessibilityLabel={path ? 'Foto de perfil. Cambiarla o quitarla' : 'Agregar foto de perfil'}
        onPress={() => (path ? setOpen(true) : pick())}
      >
        <Avatar path={path} name={name} />
        <View style={{ position: 'absolute', right: -3, bottom: -3, width: 24, height: 24, borderRadius: 12, backgroundColor: t.colors.surface, borderWidth: 1, borderColor: t.colors.border, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="camera" size={13} color={t.colors.textSecondary} />
        </View>
      </ScalePressable>

      <Sheet
        visible={open}
        title="Foto de perfil"
        onClose={close}
        testID="photo-sheet"
        footer={
          picked ? (
            <>
              <Button testID="photo-save" title="Usar esta foto" full loading={busy === 'save'} onPress={save} />
              <Button testID="photo-cancel" title="Cancelar" variant="secondary" full disabled={!!busy} onPress={close} />
            </>
          ) : (
            <>
              <Button testID="photo-pick" title={path ? 'Cambiar foto' : 'Elegir de la galería'} icon="image" full disabled={!!busy} onPress={pick} />
              {path ? <Button testID="photo-remove" title="Quitar foto" variant="ghost" full loading={busy === 'remove'} onPress={remove} /> : null}
            </>
          )
        }
      >
        <View style={{ alignItems: 'center', gap: 12, paddingVertical: 8 }}>
          <View>
            <Avatar path={path} uri={picked?.uri} name={name} size={144} />
            {busy ? (
              <View style={{ position: 'absolute', inset: 0, borderRadius: 72, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center' }}>
                <ActivityIndicator color="#FFFFFF" />
              </View>
            ) : null}
          </View>
          {picked && !busy ? <Text variant="caption" color="textMuted">Así se verá tu foto.</Text> : null}
          {error ? <Text testID="photo-error" variant="caption" color="danger" align="center">{error}</Text> : null}
        </View>
      </Sheet>
    </>
  );
}
