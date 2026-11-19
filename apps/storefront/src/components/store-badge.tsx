import Link from 'next/link';
import type { ReactNode } from 'react';
import { StoreSeal } from './store-seal';
import { storeDisplayName, storeVerification, type StoreIdentityData } from '@/lib/store-presentation';
import './store-badge.css';

export function StoreIdentity({
  store,
  href,
  linkClassName,
  as: Name = 'span',
  caption,
  trailing,
}: {
  store: StoreIdentityData;
  href?: string;
  linkClassName?: string;
  as?: 'span' | 'h1' | 'h2' | 'h3' | 'strong';
  caption?: ReactNode;
  trailing?: ReactNode;
}) {
  const name = storeDisplayName(store);
  const verification = storeVerification(store);
  const label = <>{caption && <span className="store-identity-caption">{caption}</span>}<Name className="store-identity-name">{name}</Name></>;
  return (
    <div className="store-identity">
      {href ? <Link prefetch={false} className={`store-identity-label ${linkClassName ?? ''}`} href={href}>{label}</Link>
        : <div className="store-identity-label">{label}</div>}
      {verification && <StoreSeal name={name} {...verification} />}
      {trailing}
    </div>
  );
}
