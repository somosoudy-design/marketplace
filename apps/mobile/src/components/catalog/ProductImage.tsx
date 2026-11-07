import { Image } from 'expo-image';
import { onlineManager } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { Icon } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { catalogImage } from '@/lib/supabase';
import { useProductExhibitionPhoto } from '@/lib/catalog-exhibition';
import { exhibitionSourceKey } from '@/lib/catalog-exhibition-policy';
import { useTheme } from '@/theme';

interface Props {
  productId?: string;
  variantId?: string;
  productIsDemo?: boolean;
  path: string | null | undefined;
  tone?: string | null;
  alt?: string;
  radius?: number;
  aspect?: number;
  style?: StyleProp<ViewStyle>;
  priority?: 'low' | 'normal' | 'high';
  fit?: 'cover' | 'contain';
  /** The full product gallery can explain the state; small thumbnails remain compact. */
  showUnavailableLabel?: boolean;
  /** Native visual receipts wait for the actual photo, rather than an empty image frame. */
  loadedTestID?: string;
  onExhibitionError?: (key: string) => void;
  onExhibitionLoad?: (key: string) => void;
  onRemoteError?: () => void;
}

/** Every product photo sits on its category tone at 4:5, so mixed sources still look like one catalog. */
export function ProductImage(props: Props) {
  // A changed product, variant or path is a new attempt and must not inherit an earlier failure.
  const identity = JSON.stringify([props.productId, props.variantId, props.productIsDemo, props.path]);
  return <ProductImageContent key={identity} {...props} />;
}

function ProductImageContent({ productId, variantId, productIsDemo, path, tone, alt, radius, aspect, style, priority = 'normal', fit = 'cover', showUnavailableLabel = false, loadedTestID, onExhibitionError, onExhibitionLoad, onRemoteError }: Props) {
  const t = useTheme();
  const reduced = useReducedMotion();
  const bg = t.tone(tone);
  const uri = catalogImage(path);
  const exhibition = useProductExhibitionPhoto(productId, path, variantId, productIsDemo);
  const exhibitionKey = exhibitionSourceKey(productId, path, exhibition);
  const [failed, setFailed] = useState<string>();
  const [failedRemote, setFailedRemote] = useState<string>();
  const localPhoto = exhibition && failed !== exhibitionKey ? exhibition : undefined;
  const remotePhoto = uri && failedRemote !== uri ? uri : undefined;
  const photoIdentity = localPhoto ? exhibitionKey : remotePhoto;
  const [loadedPhoto, setLoadedPhoto] = useState<string>();

  // Retry once the device actually reconnects, without repeatedly requesting a missing file.
  useEffect(() => {
    if (!failedRemote || failedRemote !== uri) return;
    let wasOffline = !onlineManager.isOnline();
    return onlineManager.subscribe(() => {
      if (!onlineManager.isOnline()) wasOffline = true;
      else if (wasOffline) setFailedRemote(undefined);
    });
  }, [failedRemote, uri]);

  return (
    <View testID={localPhoto ? `exhibition-photo-${productId}` : undefined} style={[{ aspectRatio: aspect ?? t.imagery.productAspect, backgroundColor: localPhoto?.kind === 'generated-demo' || localPhoto?.kind === 'manufacturer-reference' ? '#F5F4F1' : bg.bg, borderRadius: radius ?? t.radii.lg, overflow: 'hidden' }, style]}>
      {localPhoto || remotePhoto ? (
        <Image
          testID={loadedTestID && loadedPhoto === photoIdentity ? loadedTestID : undefined}
          source={localPhoto?.source ?? { uri: remotePhoto! }}
          style={{ width: '100%', height: '100%' }}
          contentFit={localPhoto ? 'contain' : fit}
          transition={reduced ? 0 : 180}
          priority={priority}
          recyclingKey={localPhoto ? exhibitionKey : uri ?? undefined}
          onLoadStart={loadedTestID ? () => setLoadedPhoto(undefined) : undefined}
          onError={localPhoto && exhibitionKey ? () => { setLoadedPhoto(undefined); setFailed(exhibitionKey); onExhibitionError?.(exhibitionKey); } : remotePhoto ? () => { setLoadedPhoto(undefined); setFailedRemote(remotePhoto); onRemoteError?.(); } : undefined}
          onLoad={() => {
            if (loadedTestID && photoIdentity) setLoadedPhoto(photoIdentity);
            if (localPhoto && exhibitionKey) onExhibitionLoad?.(exhibitionKey);
          }}
          accessibilityLabel={alt ?? ''}
          accessible={!!alt}
          cachePolicy="memory-disk"
        />
      ) : (
        <View testID="product-image-unavailable" accessibilityRole={alt ? 'image' : undefined} accessibilityLabel={alt ? `${alt}. Imagen no disponible` : undefined} accessible={!!alt} style={{ width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', backgroundColor: t.colors.surfaceSunken }}>
          <Icon name="image" size={24} color={t.colors.textSecondary} />
          {showUnavailableLabel ? <Text variant="caption" color="textSecondary" style={{ marginTop: 8, textAlign: 'center' }}>Imagen no disponible</Text> : null}
        </View>
      )}
    </View>
  );
}
