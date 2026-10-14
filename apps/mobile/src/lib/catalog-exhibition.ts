import { Platform } from 'react-native';
import * as Updates from 'expo-updates';
import { env } from './env';
import { exhibitionPhotos } from './catalog-exhibition-assets';
import { exhibitionEnabled, exhibitionPhoto, prioritizeExhibitionPhotos } from './catalog-exhibition-policy';

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

export function prioritizeExhibitionProducts<T extends { id: string; image_path: string | null }>(products: readonly T[]) {
  return prioritizeExhibitionPhotos(isPrivateCatalogPresentation, exhibitionPhotos, products);
}

export function productExhibitionGallery<T extends { path: string }>(productId: string, images: T[]): T[] {
  if (!isPrivateCatalogPresentation) return images;
  const cleared = images.filter((p) => productExhibitionPhoto(productId, p.path));
  return cleared.length ? cleared : images;
}
