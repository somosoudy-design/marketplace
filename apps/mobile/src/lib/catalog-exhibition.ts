import { Platform } from 'react-native';
import * as Updates from 'expo-updates';
import { env } from './env';
import { exhibitionPhotos } from './catalog-exhibition-assets';
import { exhibitionEnabled, exhibitionPhoto } from './catalog-exhibition-policy';

export const isPrivateCatalogPresentation = exhibitionEnabled({
  optIn: process.env.EXPO_PUBLIC_CATALOG_PRESENTATION,
  platform: Platform.OS,
  channel: Updates.channel,
  backendUrl: env.supabaseUrl,
  webHostname: Platform.OS === 'web' && typeof window !== 'undefined' ? window.location?.hostname : undefined,
});

export function productExhibitionPhoto(productId?: string, path?: string | null) {
  return exhibitionPhoto(isPrivateCatalogPresentation, exhibitionPhotos, productId, path);
}
