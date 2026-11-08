import { Platform } from 'react-native';
import { brand } from './brand';
import { publicBrandLink } from '../../../../config/brand-presentation';

/** Choosing a domain does not mean that hosting, HTTPS or deep links are active. */
export const webDomainReady = brand.publicWebOrigin !== null;

/**
 * Public link to a store, always /tienda/<slug> (the route the app and the web both open on that store's catalog).
 * Until the storefront origin is activated: the current web address, or the installed app's scheme.
 * Adopting the mayami name must not change native intent filters or authentication returns.
 */
export function storeLink(slug: string): string {
  return publicLink(`/tienda/${encodeURIComponent(slug)}`);
}

export function productLink(slug: string): string {
  return publicLink(`/p/${encodeURIComponent(slug)}`);
}

function publicLink(path: string): string {
  return publicBrandLink(path, Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.origin : undefined);
}

/** Whether the link only works with the app installed (no public web for it yet). */
export const appOnlyLinks = !webDomainReady && Platform.OS !== 'web';
