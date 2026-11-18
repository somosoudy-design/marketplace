'use client';

import { useState } from 'react';
import { publicImageUrl } from '@kora/api';
import { env } from '@/lib/env';

export function StoreCover({ path, official }: { path: string | null; official: boolean }) {
  return <CoverImage key={path} path={path} official={official} />;
}

function CoverImage({ path, official }: { path: string | null; official: boolean }) {
  const [failed, setFailed] = useState(false);
  const src = publicImageUrl(env.url, 'stores', path);
  return <div className="store-profile-cover" aria-hidden="true">
    {src && !failed
      ? <img src={src} alt="" onError={() => setFailed(true)}
          ref={node => { if (node?.complete && !node.naturalWidth) setFailed(true); }} />
      : official && <img className="store-profile-mark" src="/brand/mayami-v3/MAYAMI_Simbolo_Optico_Blanco.svg" alt="" />}
  </div>;
}
