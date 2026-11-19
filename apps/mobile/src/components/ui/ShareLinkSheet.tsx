import { useRef, useState } from 'react';
import { Platform, Share, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { appOnlyLinks } from '@/lib/links';
import { brand } from '@/lib/brand';
import { haptics } from '@/lib/haptics';
import { useTheme } from '@/theme';
import { Button } from './Button';
import { Sheet } from './Sheet';
import { Banner } from './States';
import { Text } from './Text';

/** A working copy fallback on browsers without the native share menu. */
export function ShareLinkSheet({ visible, title, name, link, onClose, testID }: {
  visible: boolean; title: string; name: string; link: string; onClose: () => void; testID: string;
}) {
  const t = useTheme();
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const generation = useRef(0);
  const canShare = Platform.OS !== 'web' || (typeof navigator !== 'undefined' && typeof navigator.share === 'function');
  const close = () => { generation.current++; pending.current = false; setBusy(false); setCopied(false); setError(false); onClose(); };
  const run = async (action: 'share' | 'copy') => {
    if (pending.current) return;
    pending.current = true; setBusy(true); setError(false); setCopied(false);
    const current = generation.current;
    try {
      if (action === 'copy') {
        // Expo's web legacy fallback reports success even when execCommand returns false.
        // Keep web confirmation tied to the browser's actual clipboard promise.
        if (Platform.OS === 'web') {
          if (!navigator.clipboard?.writeText) throw new Error('clipboard_unavailable');
          await navigator.clipboard.writeText(link);
        } else if (!await Clipboard.setStringAsync(link)) throw new Error('clipboard_unavailable');
        if (generation.current === current) { setCopied(true); haptics.success(); }
      } else {
        const message = `${name} en ${brand.name}: ${link}`;
        await Share.share(Platform.OS === 'ios' ? { url: link, message: name } : Platform.OS === 'web' ? { title: name, message, url: link } : { message });
        if (generation.current === current) close();
      }
    } catch (failure) {
      if (generation.current === current && !(action === 'share' && failure instanceof Error && failure.name === 'AbortError')) setError(true);
    } finally { if (generation.current === current) { pending.current = false; setBusy(false); } }
  };
  return (
    <Sheet visible={visible} title={title} onClose={close} testID={`${testID}-sheet`} footer={<>
      {canShare ? <Button testID={`${testID}-native`} title="Compartir" icon="share-2" full disabled={busy} onPress={() => void run('share')} /> : null}
      <Button testID={`${testID}-copy`} title={copied ? 'Enlace copiado' : 'Copiar enlace'} icon={copied ? 'check' : 'copy'} variant="secondary" full disabled={busy} onPress={() => void run('copy')} />
    </>}>
      <View style={{ gap: 8 }}>
        <View style={{ padding: 12, borderRadius: t.radii.sm, backgroundColor: t.colors.surfaceSunken }}>
          <Text testID={`${testID}-link`} variant="bodySmall" selectable>{link}</Text>
        </View>
        {appOnlyLinks ? <Text variant="caption" color="textSecondary">Este enlace abre {name} en la app {brand.name} instalada.</Text> : null}
        {error ? <Banner tone="danger" body="No pudimos compartir el enlace. Puedes seleccionarlo y copiarlo aquí o volver a intentar." /> : null}
      </View>
    </Sheet>
  );
}
