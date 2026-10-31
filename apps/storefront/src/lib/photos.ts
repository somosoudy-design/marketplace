import { publicImageUrl } from '@kora/api';
import registry from '../../.generated/catalog.json';
import { env } from './env';
import {
  exhibitionPhoto,
  commercialCatalogText,
  type ExhibitionPhoto,
} from '../../../mobile/src/lib/catalog-exhibition-policy';
type WebPhoto = Omit<ExhibitionPhoto, 'source'> & { source: string };
const photos = registry as WebPhoto[];
export const localExhibition = photos.length > 0;
export function photo(id: string, path: string | null, demo: boolean, variantId?: string) {
  // Same identity, original-path, sample-status and variant gates as Android.
  return exhibitionPhoto(
    localExhibition,
    photos as unknown as ExhibitionPhoto[],
    id,
    path,
    variantId,
    demo,
  ) as unknown as WebPhoto | undefined;
}
export const imageUrl = (id: string, path: string | null, demo: boolean, variantId?: string) =>
  photo(id, path, demo, variantId)?.source ?? publicImageUrl(env.url, 'catalog', path);
export const catalogText = (text: string | null | undefined, demo: boolean) =>
  commercialCatalogText(localExhibition, text, demo);
