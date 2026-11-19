import { expect, it } from 'vitest';
import { unassignedProductImages, reviewedGeneralProductImages } from '../../../apps/mobile/src/lib/selection-media';

it('does not treat photographs assigned to another variant as general media', () => {
  const black = { id: 'black-photo', path: 'products/black.webp' };
  const white = { id: 'white-photo', path: 'products/white.webp' };
  const general = { id: 'general-photo', path: 'products/dimensions.webp' };
  expect(unassignedProductImages([black, white, general], [black, white])).toEqual([general]);
});
it('excludes duplicate image paths even if the duplicate has another image row ID', () => {
  expect(unassignedProductImages([{ id: 'duplicate', path: 'white.webp' }], [{ id: 'assigned', path: 'white.webp' }])).toEqual([]);
});
it('retains originals without mutation and leaves a truthful empty fallback when all media is assigned', () => {
  const images = Object.freeze([Object.freeze({ id: 'one', path: 'one.webp' })]);
  expect(unassignedProductImages(images, [])).toEqual(images);
  expect(unassignedProductImages(images, images)).toEqual([]);
  expect(images).toEqual([{ id: 'one', path: 'one.webp' }]);
});
it('uses only server-classified general images even when hidden variants own other originals', () => {
  const hidden = { id: 'hidden-photo', path: 'hidden-white.webp' };
  const general = { id: 'general', path: 'dimensions.webp' };
  const product = { images: [hidden, general], general_images: [general] };
  expect(reviewedGeneralProductImages(product)).toEqual([general]);
});
it('fails closed when the server did not return general classification', () => {
  const product = { images: [{ id: 'hidden-photo', path: 'hidden-white.webp' }], general_images: undefined };
  expect(reviewedGeneralProductImages(product)).toEqual([]);
  expect(reviewedGeneralProductImages({ general_images: null })).toEqual([]);
});
