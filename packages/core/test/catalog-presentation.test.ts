import { describe, expect, it } from 'vitest';
import { bannerTitle, photoChoiceNotice } from '../src/catalog-presentation';

describe('buyer-facing catalogue presentation', () => {
  it('keeps measurement units with their quantity and preserves product wording', () => {
    const title = 'Batería externa JUOVI de 20.000 mAh y 65 W';
    const display = bannerTitle(title);
    expect(display).toBe('Batería externa JUOVI de 20.000\u00a0mAh y 65\u00a0W');
    expect(display.replaceAll('\u00a0', ' ')).toBe(title);
    expect(bannerTitle('DJI Mic 3 (2 TX + 1 RX + Charging Case)')).toBe('DJI Mic 3 (2\u00a0TX + 1\u00a0RX + Charging Case)');
    expect(bannerTitle('FIFINE AM8 · 65W · 128GB')).toBe('FIFINE AM8 · 65W · 128GB');
  });

  it('does not expose an internal unknown association for a single choice', () => {
    const input = { selectedVariantId: 'a', variants: [{ id: 'a', active: true }], mediaState: 'unclassified' as const, imagePath: 'product.jpg' };
    expect(photoChoiceNotice(input)).toBeNull();
    expect(input.mediaState).toBe('unclassified');
  });

  it('explains a genuine choice ambiguity, including an active sold-out choice', () => {
    const input = { selectedVariantId: 'a', variants: [{ id: 'a', active: true }, { id: 'b', active: true, stock: 0 }], mediaState: 'unclassified' as const, imagePath: 'product.jpg' };
    expect(photoChoiceNotice(input)).toBe('Las fotos pueden variar según la opción elegida.');
    expect(photoChoiceNotice({ ...input, variants: [...input.variants, input.variants[0]!] })).toBe(photoChoiceNotice(input));
    expect(photoChoiceNotice({ ...input, variants: [{ id: 'a', active: true }, { id: 'b', active: false }] })).toBeNull();
  });

  it('does not infer photos or certainty for assigned, absent or invalid choices', () => {
    const input = { selectedVariantId: 'a', variants: [{ id: 'a', active: true }, { id: 'b', active: true }], mediaState: 'unclassified' as const, imagePath: 'product.jpg' };
    for (const mediaState of ['assigned', 'none'] as const) expect(photoChoiceNotice({ ...input, mediaState })).toBeNull();
    expect(photoChoiceNotice({ ...input, imagePath: null })).toBeNull();
    expect(photoChoiceNotice({ ...input, selectedVariantId: 'missing' })).toBeNull();
    expect(photoChoiceNotice({ ...input, variants: undefined })).toBeNull();
  });
});
