import type { Store } from '@kora/api';
import Link from 'next/link';
import { Info, Package, Truck } from 'lucide-react';
import { hasOfficialSeal, isLegacyOfficialCover, storeDisplayName } from '@/lib/store-presentation';
import { StoreAvatar } from './store-avatar';
import { StoreCover } from './store-cover';
import { StoreFollow } from './store-follow';
import { StoreIdentity } from './store-badge';
import { ShareLink } from './product-share';
import './store-profile.css';

const policyNames: Record<string, string> = { returns: 'Devoluciones', warranty: 'Garantía', shipping: 'Envíos' };

export function StoreProfile({ store, catalogHref, aboutHref, showAbout }: {
  store: Store;
  catalogHref: string;
  aboutHref: string;
  showAbout: boolean;
}) {
  const name = storeDisplayName(store);
  const official = hasOfficialSeal(store);
  const cover = isLegacyOfficialCover(store) ? null : store.cover_path;
  const shipping = official && /^Despachos desde Caracas\b/i.test(store.shipping_info ?? '')
    ? 'Desde Caracas, directo a ti'
    : store.shipping_info;
  const policies = Object.entries(store.policies ?? {}).filter((entry): entry is [string, string] =>
    typeof entry[1] === 'string' && !!entry[1].trim());
  return (
    <div className="store-profile" data-accent={store.accent} data-official={official || undefined}>
      <section className="store-profile-hero" aria-label="Perfil de la tienda">
        <StoreCover path={cover} official={official} />
        <div className="store-profile-identity">
          <StoreAvatar id={store.id} name={name} path={store.logo_path} />
          <div className="store-profile-name">
            <StoreIdentity as="h1" store={store} />
            {store.tagline && <p><em>{store.tagline}</em></p>}
          </div>
        </div>
        {shipping && <p className="store-profile-shipping"><Truck size={18} aria-hidden="true" />{shipping}</p>}
        <div className="store-profile-actions">
          <StoreFollow storeId={store.id} returnTo={showAbout ? aboutHref : catalogHref} />
          <ShareLink kind="store" slug={store.slug} title={name} />
        </div>
      </section>
      <nav className="store-profile-tabs" aria-label="Secciones de la tienda">
        <Link href={catalogHref} prefetch={false} aria-current={showAbout ? undefined : 'page'}><Package size={18} aria-hidden="true" />Productos</Link>
        <Link href={aboutHref} prefetch={false} aria-current={showAbout ? 'page' : undefined}><Info size={18} aria-hidden="true" />Sobre la tienda</Link>
      </nav>
      {showAbout && <section className="store-profile-about" aria-labelledby="store-about-title">
        <h2 id="store-about-title">Sobre la tienda</h2>
        {store.description && <p>{store.description}</p>}
        {store.shipping_info && <section><h3>Despacho</h3><p>{store.shipping_info}</p></section>}
        {policies.map(([key, value]) => <section key={key}><h3>{policyNames[key] ?? key}</h3><p>{value}</p></section>)}
        {!store.description && !store.shipping_info && !policies.length && <p>Esta tienda aún no ha publicado información adicional.</p>}
      </section>}
    </div>
  );
}
