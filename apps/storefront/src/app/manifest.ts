import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'Mayami',
    short_name: 'Mayami',
    lang: 'es-VE',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    theme_color: '#5700d9',
    background_color: '#5700d9',
    icons: [
      { src: '/brand/pwa/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/brand/pwa/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  };
}
