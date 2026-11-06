import { Image, type ImageStyle } from 'expo-image';
import type { StyleProp } from 'react-native';
import { isLegacyMayamiStoreLogo } from '@/lib/store-logo';
import { storeImage } from '@/lib/supabase';

const mayamiIcon = require('../../../assets/images/mayami/android-icon.png');

/** Leave other stores and any future owner-uploaded logo untouched. */
export function StoreLogo({ id, path, style }: { id: string; path: string; style?: StyleProp<ImageStyle> }) {
  const legacy = isLegacyMayamiStoreLogo(id, path);
  return <Image testID={legacy ? 'mayami-store-logo' : undefined} source={legacy ? mayamiIcon : { uri: storeImage(path) ?? undefined }} accessibilityLabel="" accessible={false} style={style} contentFit="cover" transition={150} />;
}
