import type { Store } from '@kora/api';
import { Package, Store as StoreIcon, Truck } from 'lucide-react';
import { hasOfficialSeal, isLegacyOfficialCover, storeDisplayName } from '@/lib/store-presentation';
import { StoreAvatar } from './store-avatar';
import { StoreCover } from './store-cover';
import { OfficialStoreSeal } from './store-badge';
import { ShareLink } from './product-share';
import './store-profile.css';

const policyNames: Record<string, string> = { returns: 'Devoluciones', warranty: 'Garantía', shipping: 'Envíos' };

export function StoreProfile({ store, hasCatalog }: { store: Store; hasCatalog: boolean }) {
  const name = storeDisplayName(store);
  const official = hasOfficialSeal(store);
  const cover = isLegacyOfficialCover(store) ? null : store.cover_path;
  const policies = Object.entries(store.policies ?? {}).filter((entry): entry is [string, string] =>
    typeof entry[1] === 'string' && !!entry[1].trim());
  const about = !!(store.description || policies.length);
  return (
    <section className="store-profile" aria-label="Perfil de la tienda" data-accent={store.accent} data-official={official || undefined}>
      <div className="store-profile-hero">
        <StoreCover path={cover} official={official} />
        <div className="store-profile-identity">
          <StoreAvatar id={store.id} name={name} path={store.logo_path} />
          <div className="store-profile-name">
            <div className="store-profile-title">
              <h1>{name}</h1>
              {official && <OfficialStoreSeal explain />}
            </div>
            {store.tagline && <p>{store.tagline}</p>}
          </div>
        </div>
        {store.shipping_info && <p className="store-profile-shipping"><Truck size={18} aria-hidden="true" />{store.shipping_info}</p>}
        <div className="store-profile-actions">
          {hasCatalog && <a className="button" href="#productos"><Package size={18} aria-hidden="true" />Ver productos</a>}
          <ShareLink kind="store" slug={store.slug} title={name} />
        </div>
      </div>
      {about && <details className="store-profile-about">
        <summary><StoreIcon size={18} aria-hidden="true" />Sobre la tienda</summary>
        <div>
          {store.description && <p>{store.description}</p>}
          {policies.map(([key, value]) => <section key={key}><h2>{policyNames[key] ?? key}</h2><p>{value}</p></section>)}
        </div>
      </details>}
    </section>
  );
}
