import { describe, expect, it } from 'vitest';
import type { CatalogMetadata, SellerProductReview } from '@kora/api';
import { catalogMetadataMatchesReview } from '../src/lib/catalog-metadata-review';
function fixture() {
  const photo = { id: 'image-a', path: 'fixture/a.webp', alt: null, width: 800, height: 800, sort: 0 };
  const review = { product: { id: 'product-a', updated_at: '2026-11-07T00:00:00.000001+00:00', condition: null,
    product_variants: [{ id: 'variant-a', updated_at: '2026-11-07T00:00:00.000002+00:00' }], product_images: [photo] } } as unknown as SellerProductReview;
  const metadata = { product_id: 'product-a', updated_at: review.product.updated_at, condition: null, colors: [], general_images: [photo],
    variants: [{ variant_id: 'variant-a', updated_at: review.product.product_variants[0]!.updated_at, images: [] }] } as unknown as CatalogMetadata;
  return { review, metadata };
}
describe('metadata controls stay on the reviewed editor base', () => {
  it('permits an exact reviewed product and explicit photo set', () => { const f = fixture(); expect(catalogMetadataMatchesReview(f.review, f.metadata)).toBe(true); });
  it('never treats unclassified as new', () => { const f = fixture(); f.metadata.condition = 'new'; expect(catalogMetadataMatchesReview(f.review, f.metadata)).toBe(false); });
  it('detects one microsecond of metadata version change without Date truncation', () => { const f = fixture(); f.metadata.updated_at = '2026-11-07T00:00:00.000002+00:00'; expect(catalogMetadataMatchesReview(f.review, f.metadata)).toBe(false); });
  it('detects a changed variant revision even when product timestamp is unchanged', () => { const f = fixture(); f.metadata.variants[0]!.updated_at = '2026-11-07T00:00:00.000003+00:00'; expect(catalogMetadataMatchesReview(f.review, f.metadata)).toBe(false); });
  it('does not accept another product or added/removed variants', () => { const f = fixture(); f.metadata.product_id = 'other-product'; expect(catalogMetadataMatchesReview(f.review, f.metadata)).toBe(false); f.metadata.product_id = 'product-a'; f.metadata.variants = []; expect(catalogMetadataMatchesReview(f.review, f.metadata)).toBe(false); });
  it('accounts for photos assigned to variants as well as general photos', () => { const f = fixture(); f.metadata.variants[0]!.images = f.metadata.general_images!; f.metadata.general_images = []; expect(catalogMetadataMatchesReview(f.review, f.metadata)).toBe(true); });
  it('detects photo changes, without assuming the thumbnail still represents the same row', () => { const f = fixture(); f.metadata.general_images![0] = { ...f.metadata.general_images![0]!, path: 'fixture/replaced.webp' }; expect(catalogMetadataMatchesReview(f.review, f.metadata)).toBe(false); });
  it('detects a photo added outside the form without relying on a product timestamp update', () => { const f = fixture(); f.metadata.general_images!.push({ ...f.metadata.general_images![0]!, id: 'image-b' }); expect(catalogMetadataMatchesReview(f.review, f.metadata)).toBe(false); });
});
