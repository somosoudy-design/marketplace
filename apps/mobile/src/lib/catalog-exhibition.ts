import { Platform } from 'react-native';
import * as Updates from 'expo-updates';
import { useQuery } from '@tanstack/react-query';
import { env } from './env';
import { qk } from './query';
import { api } from './supabase';
import { exhibitionPhotos } from './catalog-exhibition-assets';
import { exhibitionCategoryPhoto, exhibitionEnabled, exhibitionGallery, exhibitionImagesEnabled, exhibitionPhoto, prioritizeExhibitionPhotos, prioritizeGeneratedExhibition } from './catalog-exhibition-policy';

export const isPrivateCatalogPresentation = exhibitionEnabled({
  optIn: process.env.EXPO_PUBLIC_CATALOG_PRESENTATION,
  platform: Platform.OS,
  channel: Updates.channel,
  backendUrl: env.supabaseUrl,
  webHostname: Platform.OS === 'web' && typeof window !== 'undefined' ? window.location?.hostname : undefined,
});
export const showExhibitionImages = exhibitionImagesEnabled(isPrivateCatalogPresentation, Platform.OS);

export function productExhibitionPhoto(productId?: string, path?: string | null, variantId?: string, isDemo?: boolean) {
  return exhibitionPhoto(showExhibitionImages, exhibitionPhotos, productId, path, variantId, isDemo);
}

export const categoryExhibitionPhoto = (path?: string | null) => exhibitionCategoryPhoto(showExhibitionImages, exhibitionPhotos, path);

/** Snapshot-only DTOs cannot prove sample status. Verify before showing sample-only imagery. */
export function useProductExhibitionPhoto(productId?: string, path?: string | null, variantId?: string, isDemo?: boolean) {
  const candidate = productExhibitionPhoto(productId, path, variantId, true);
  const verify = (candidate?.kind === 'generated-demo' || candidate?.kind === 'manufacturer-reference') && isDemo === undefined;
  const product = useQuery({
    queryKey: qk.product(productId ?? ''),
    queryFn: () => api.catalog.product(productId!),
    enabled: verify,
    refetchOnMount: 'always',
    retry: false,
  });
  const current = verify && product.isSuccess && !product.isFetching && !product.isPaused && !product.isError ? product.data : undefined;
  const confirmed = isDemo ?? (!!current?.is_demo &&
    (current.image_path === path || current.images.some((image) => image.path === path)) &&
    (!variantId || current.variants.some((variant) => variant.id === variantId)));
  return productExhibitionPhoto(productId, path, variantId, confirmed);
}

export function prioritizeGeneratedProducts<T extends { id: string; image_path: string | null; is_demo: boolean }>(products: readonly T[]) {
  return prioritizeGeneratedExhibition(showExhibitionImages, exhibitionPhotos, products);
}

export function prioritizeExhibitionProducts<T extends { id: string; image_path: string | null }>(products: readonly T[]) {
  return prioritizeExhibitionPhotos(showExhibitionImages, exhibitionPhotos, products);
}

export function productExhibitionGallery<T extends { path: string }>(productId: string, images: T[], isDemo?: boolean): T[] {
  return exhibitionGallery(showExhibitionImages, exhibitionPhotos, productId, images, isDemo);
}
