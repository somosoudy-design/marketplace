'use client';
import { useEffect, useState } from 'react';
import { ImageOff } from 'lucide-react';
import { imageUrl } from '@/lib/photos';
import { publicImageUrl } from '@kora/api';
import { env } from '@/lib/env';
export function ProductPhoto({
  id,
  path,
  demo,
  title,
  variant,
  priority = false,
  exact = false,
  alphaMask,
}: {
  id: string;
  path: string | null;
  demo: boolean;
  title: string;
  variant?: string;
  priority?: boolean;
  exact?: boolean;
  /** Navigation-only alpha matte; the original image RGB/source remain unchanged. */
  alphaMask?: string;
}) {
  const src = exact ? publicImageUrl(env.url, 'catalog', path) : imageUrl(id, path, demo, variant);
  // A different product/variant/photo is a new load attempt, including A → B → A.
  return <PhotoContent key={JSON.stringify([id, path, variant, exact, src])}
    src={src} title={title} priority={priority} alphaMask={alphaMask} />;
}

function PhotoContent({ src, title, priority, alphaMask }: {
  src: string | null;
  title: string;
  priority: boolean;
  alphaMask?: string;
}) {
  const [failed, setFailed] = useState<{ offline: boolean } | null>(null);
  // Only a genuine reconnection retries a failed source. Repeated online events
  // or a permanent 404 must not create a request loop or change its identity.
  useEffect(() => {
    if (!failed || !src) return;
    let active = true;
    let wasOffline = failed.offline || !window.navigator.onLine;
    const offline = () => { wasOffline = true; };
    const online = () => {
      if (active && wasOffline && window.navigator.onLine) { wasOffline = false; setFailed(null); }
    };
    window.addEventListener('offline', offline);
    window.addEventListener('online', online);
    // The browser may reconnect after onError but before this passive effect.
    // Preserve the captured offline state and reconcile once, after subscribing.
    if (wasOffline && window.navigator.onLine) queueMicrotask(online);
    return () => {
      active = false;
      window.removeEventListener('offline', offline);
      window.removeEventListener('online', online);
    };
  }, [failed, src]);
  const [readyMask, setReadyMask] = useState<string | null>(null);
  useEffect(() => {
    if (!alphaMask) return;
    let active = true;
    const probe = new window.Image();
    probe.onload = () => { if (active) setReadyMask(alphaMask); };
    // If the optional matte fails, retain the original image and its existing fallback.
    probe.src = alphaMask;
    return () => { active = false; probe.onload = null; };
  }, [alphaMask]);
  return (
    <div className="product-photo">
      {src && !failed ? (
        <img src={src} alt={title} loading={priority ? 'eager' : 'lazy'} onError={() => setFailed({ offline: !window.navigator.onLine })}
          ref={node => {
            // The SSR image may already have failed before React attaches onError.
            if (node?.complete && node.naturalWidth === 0) setFailed({ offline: !window.navigator.onLine });
          }}
          style={alphaMask && readyMask === alphaMask ? {
            maskImage: `url("${alphaMask}")`, maskMode: 'alpha', maskSize: '100% 100%', maskRepeat: 'no-repeat',
            WebkitMaskImage: `url("${alphaMask}")`, WebkitMaskSize: '100% 100%', WebkitMaskRepeat: 'no-repeat',
          } : undefined} />
      ) : (
        <span className="photo-missing">
          <ImageOff size={24} />
          Imagen no disponible
        </span>
      )}
    </div>
  );
}
