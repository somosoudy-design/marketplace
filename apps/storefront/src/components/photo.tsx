'use client';
import { useState } from 'react';
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
}: {
  id: string;
  path: string | null;
  demo: boolean;
  title: string;
  variant?: string;
  priority?: boolean;
  exact?: boolean;
}) {
  const src = exact ? publicImageUrl(env.url, 'catalog', path) : imageUrl(id, path, demo, variant);
  const [failed, setFailed] = useState<string | null>(null);
  return (
    <div className="product-photo">
      {src && failed !== src ? (
        <img src={src} alt={title} loading={priority ? 'eager' : 'lazy'} onError={() => setFailed(src)} />
      ) : (
        <span className="photo-missing">
          <ImageOff size={24} />
          Imagen no disponible
        </span>
      )}
    </div>
  );
}
