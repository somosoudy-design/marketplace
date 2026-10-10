import { Platform } from 'react-native';
import { brand } from './brand';

/** config/brand.json still has the placeholder domain (example.com is reserved for examples): no web lives there yet. */
export const webDomainReady = !/(^|\.)example\.(com|org|net)$/.test(brand.webDomain);

/**
 * Public link to a store, always /tienda/<slug> (the route the app and the web both open on that store's catalog).
 * With a real domain in config/brand.json: https://<domain>/tienda/<slug>, which opens the app where it's installed
 * (Android intent filter) and the web otherwise. Until then, only addresses that work today: on the web, the address
 * the app is served from; in the app, <scheme>://tienda/<slug>, which opens the store in the app.
 */
export function storeLink(slug: string): string {
  const path = `/tienda/${encodeURIComponent(slug)}`;
  if (webDomainReady) return `https://${brand.webDomain}${path}`;
  if (Platform.OS === 'web' && typeof window !== 'undefined') return `${window.location.origin}${path}`;
  return `${brand.scheme}:/${path}`;
}

/** Whether the link only works with the app installed (no public web for it yet). */
export const appOnlyLinks = !webDomainReady && Platform.OS !== 'web';
