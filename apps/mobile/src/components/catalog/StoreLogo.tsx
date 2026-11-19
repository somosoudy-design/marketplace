import { Image, type ImageStyle } from 'expo-image';
import { Platform, type StyleProp } from 'react-native';
import { isLegacyMayamiStoreLogo } from '@/lib/store-logo';
import { storeImage } from '@/lib/supabase';

const mayamiIcon = require('../../../assets/images/mayami/android-icon.png');

/** Leave other stores and any future owner-uploaded logo untouched. */
export function StoreLogo({ id, path, style, label, fit = 'cover' }: { id: string; path: string; style?: StyleProp<ImageStyle>; label?: string; fit?: 'contain' | 'cover' }) {
  const legacy = Platform.OS !== 'ios' && isLegacyMayamiStoreLogo(id, path);
  return <Image testID={legacy ? 'mayami-store-logo' : undefined} source={legacy ? mayamiIcon : { uri: storeImage(path) ?? undefined }} accessibilityLabel={label ?? ''} accessible={!!label} style={style} contentFit={fit} transition={legacy ? 0 : 150} />;
}
