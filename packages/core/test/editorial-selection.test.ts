import { expect, it } from 'vitest';
import type { CatalogMetadata, ProductCard } from '../../api/src/types';
import { reviewedEditorialPreview } from '../../../apps/mobile/src/lib/editorial-selection';
const product = { availability: 'available', price_usd: 5, image_path: 'white.webp' } as ProductCard;
const image = (id: string, path: string) => ({ id, path, alt: null, width: 800, height: 800, sort: 0 });
const variant = (id: string, path: string, price: number) => ({ variant_id: id, title: id, options: { Color: id }, sku: id, price_usd: price, stock: 5, active: true, updated_at: '2026-11-07T00:00:00Z', color: id, media_classified: true, media_state: 'mapped' as const, images: [image(id,path)] });
const metadata = { product_id: 'product', condition: 'refurbished', updated_at: '2026-11-07T00:00:00Z', general_images: [], colors: ['Negro','Blanco'], variants: [variant('Negro','black.webp',25),variant('Blanco','white.webp',40)] } satisfies CatalogMetadata;
it('takes hero price, image and destination from the same stable explicit variant', () => {
 const preview=reviewedEditorialPreview(product, metadata);
 expect(preview.variantId).toBe('Negro');expect(preview.price).toBe(25);expect(preview.imagePath).toBe('black.webp');expect(preview.generalImage).toBe(false);
});
it('does not revive a legacy hero photo or price when metadata is absent or no variant is visible', () => {
 for(const value of [undefined, null, {...metadata,variants:[]}]){
  const preview=reviewedEditorialPreview(product,value);expect(preview.variantId).toBeUndefined();expect(preview.price).toBeNull();expect(preview.imagePath).toBeNull();
 }
});
it('uses only server-classified general photographs for an unclassified variant', () => {
 const row={...variant('Negro','black.webp',25),media_classified:false,media_state:'unknown' as const,images:[]};
 const preview=reviewedEditorialPreview(product,{...metadata,variants:[row],general_images:[image('diagram','dimensions.webp')]});
 expect(preview.imagePath).toBe('dimensions.webp');expect(preview.generalImage).toBe(true);
 expect(reviewedEditorialPreview(product,{...metadata,variants:[row],general_images:undefined}).imagePath).toBeNull();
});
it('preserves No disponible with stock, distinguishing an exhausted variant', () => {
 expect(reviewedEditorialPreview({...product,availability:'unavailable'},metadata).availability.label).toBe('No disponible');
 const preview=reviewedEditorialPreview(product,{...metadata,variants:[{...metadata.variants[0]!,stock:0}]});
 expect(preview.availability.label).toBe('Agotado');
});
