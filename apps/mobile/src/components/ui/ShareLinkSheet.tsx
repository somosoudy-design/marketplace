import { useState } from 'react';
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
  const canShare = Platform.OS !== 'web' || (typeof navigator !== 'undefined' && typeof navigator.share === 'function');
  const close = () => { setCopied(false); setError(false); onClose(); };
  const share = async () => {
    try {
      const message = `${name} en ${brand.name}: ${link}`;
      await Share.share(Platform.OS === 'ios' ? { url: link, message: name } : Platform.OS === 'web' ? { title: name, message, url: link } : { message });
      close();
    } catch { setError(true); }
  };
  const copy = async () => {
    try { await Clipboard.setStringAsync(link); setCopied(true); setError(false); haptics.success(); }
    catch { setError(true); }
  };
  return (
    <Sheet visible={visible} title={title} onClose={close} testID={`${testID}-sheet`} footer={<>
      {canShare ? <Button title="Compartir" icon="share-2" full onPress={share} /> : null}
      <Button testID={`${testID}-copy`} title={copied ? 'Enlace copiado' : 'Copiar enlace'} icon={copied ? 'check' : 'copy'} variant="secondary" full onPress={copy} />
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
