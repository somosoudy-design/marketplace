'use client';
import { useState } from 'react';
import { publicImageUrl } from '@kora/api';
import { env } from '@/lib/env';

export function storeInitials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map(word => Array.from(word)[0] ?? '').join('').toLocaleUpperCase('es');
}

export function StoreAvatar({ id, name, path }: { id?: string; name: string; path: string | null }) {
  // Remount when a store changes its logo, so an old failure cannot hide the new image.
  return <AvatarImage key={`${id ?? ''}:${path ?? ''}`} id={id} name={name} path={path} />;
}

function AvatarImage({ id, name, path }: { id?: string; name: string; path: string | null }) {
  const [failed, setFailed] = useState(false);
  // Same exact obsolete asset gate as the native StoreLogo; future uploaded logos win.
  const legacy = id === '5afbabbf-0678-40ee-a5d8-540f53efe114' && path === 'demo/kora-logo.webp';
  const src = legacy ? '/icon.svg' : publicImageUrl(env.url, 'stores', path);
  return <span className="store-initial" aria-hidden="true">
    {src && !failed ? <img src={src} alt="" loading="lazy" onError={() => setFailed(true)}
      ref={node => { if (node?.complete && node.naturalWidth === 0) setFailed(true); }} /> : storeInitials(name)}
  </span>;
}
