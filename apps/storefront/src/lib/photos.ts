import { publicImageUrl } from '@kora/api';
import registry from '../../.generated/catalog.json';
import commercialManifest from '../data/commercial-catalog.json';
import { createCommercialCatalog } from './commercial-catalog-policy.mjs';
import { env } from './env';
import {
  exhibitionPhoto,
  exhibitionGallery,
  commercialCatalogText,
  type ExhibitionPhoto,
} from '../../../mobile/src/lib/catalog-exhibition-policy';
type WebPhoto = Omit<ExhibitionPhoto, 'source'> & { source: string };
const photos = registry as WebPhoto[];
const commercial = createCommercialCatalog(commercialManifest);
export const commercialApproved = commercial.approved;
export const catalogSample = commercial.sample;
export function catalogGallery<T extends { path: string }>(id: string, images: T[], demo: boolean, variant?: string): T[] {
  return commercialApproved(id) ? commercial.gallery(id, images, variant) :
    exhibitionGallery(localExhibition, photos as unknown as ExhibitionPhoto[], id, images, demo);
}
export const localExhibition = photos.length > 0;
export function photo(id: string, path: string | null, demo: boolean, variantId?: string) {
  const approved = commercial.photo(id, path, variantId);
  if (approved) return approved;
  // Local preview remains separate, with the existing Android identity and variant gates.
  return exhibitionPhoto(
    localExhibition,
    photos as unknown as ExhibitionPhoto[],
    id,
    path,
    variantId,
    demo,
  ) as unknown as WebPhoto | undefined;
}
export const imageUrl = (id: string, path: string | null, demo: boolean, variantId?: string) => {
  const selected = photo(id, path, demo, variantId);
  if (selected) return selected.source;
  if (commercial.blockedLegacy(id, path)) return null;
  return publicImageUrl(env.url, 'catalog', path);
};
export const catalogText = (text: string | null | undefined, demo: boolean, id?: string) =>
  commercialCatalogText(localExhibition || (!!id && commercialApproved(id)), text, demo);
