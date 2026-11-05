import installedBrand from './brand.json';

/** Optical sizes for interface contexts, refined with Oliver after reviewing the 144px header. */
export const brandMarkWidths = { navigation: 112, compact: 96, access: 144 } as const;

/** Product identity for UI only. app.config.ts must keep reading the installed APK's brand.json. */
export const brand = {
  ...installedBrand,
  name: 'mayami',
  shortName: 'mayami',
  officialDomain: 'mayami.app',
  // Activate only after HTTPS, storefront routes and authentication returns have been verified.
  publicWebOrigin: null as string | null,
};

/** Keep shared catalog links usable until the chosen domain is actually serving the storefront. */
export function publicBrandLink(path: string, currentWebOrigin?: string): string {
  const origin = brand.publicWebOrigin ?? currentWebOrigin;
  return origin ? `${origin}${path}` : `${brand.scheme}:/${path}`;
}
