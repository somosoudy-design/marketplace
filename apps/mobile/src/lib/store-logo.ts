/** Replace only the known obsolete Mayami logo; a newly uploaded store logo always wins. */
export function isLegacyMayamiStoreLogo(storeId: string | undefined, path: string | null | undefined): boolean {
  return storeId === '5afbabbf-0678-40ee-a5d8-540f53efe114' && path === 'demo/kora-logo.webp';
}
