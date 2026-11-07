import { describe, expect, it, vi } from 'vitest';
import { legalDocuments, openLegalDocument } from '../../apps/mobile/src/lib/legal-links';
describe('mobile public legal documents', () => {
  it.each(['privacy', 'terms', 'deletion'] as const)('opens the canonical HTTPS %s document without an account or app scheme', async document => {
    const open = vi.fn().mockResolvedValue(undefined);
    expect(await openLegalDocument(document, open)).toBeNull();
    expect(open).toHaveBeenCalledOnce();
    expect(open).toHaveBeenCalledWith(legalDocuments[document].url);
    expect(new URL(legalDocuments[document].url).origin).toBe('https://mayami.app');
  });
  it.each([false, new Error('no browser available')])('gives a usable public address when opening fails: %s', async result => {
    const open = result instanceof Error ? vi.fn().mockRejectedValue(result) : vi.fn().mockResolvedValue(result);
    const message = await openLegalDocument('privacy', open);
    expect(message).toContain('No pudimos abrir'); expect(message).toContain('https://mayami.app/privacidad');
    expect(message).not.toContain('no browser available');
  });
});
