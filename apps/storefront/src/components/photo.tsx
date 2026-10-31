'use client';
import { useState } from 'react';
import { ImageOff } from 'lucide-react';
import { imageUrl } from '@/lib/photos';
export function ProductPhoto({
  id,
  path,
  demo,
  title,
  variant,
  priority = false,
}: {
  id: string;
  path: string | null;
  demo: boolean;
  title: string;
  variant?: string;
  priority?: boolean;
}) {
  const src = imageUrl(id, path, demo, variant);
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
