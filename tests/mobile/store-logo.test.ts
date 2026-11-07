import { describe, expect, it } from 'vitest';
import { isLegacyMayamiStoreLogo } from '../../apps/mobile/src/lib/store-logo';

describe('Mayami store logo transition', () => {
  it('replaces only the obsolete logo of the known store', () => {
    const id = '5afbabbf-0678-40ee-a5d8-540f53efe114';
    expect(isLegacyMayamiStoreLogo(id, 'demo/kora-logo.webp')).toBe(true);
    expect(isLegacyMayamiStoreLogo(id, 'stores/new-owner-logo.webp')).toBe(false);
    expect(isLegacyMayamiStoreLogo('another-store', 'demo/kora-logo.webp')).toBe(false);
    expect(isLegacyMayamiStoreLogo(id, null)).toBe(false);
  });
});
