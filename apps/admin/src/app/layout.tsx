import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import { Providers } from '@/lib/providers';
import './globals.css';
import { brand } from '@/lib/brand';

// one family, as in the app: Plus Jakarta Sans for titles, interface and prices
const jakarta = localFont({
  variable: '--font-jakarta',
  display: 'swap',
  src: [
    { path: '../fonts/PlusJakartaSans_400Regular.ttf', weight: '400' },
    { path: '../fonts/PlusJakartaSans_500Medium.ttf', weight: '500' },
    { path: '../fonts/PlusJakartaSans_600SemiBold.ttf', weight: '600' },
    { path: '../fonts/PlusJakartaSans_700Bold.ttf', weight: '700' },
    { path: '../fonts/PlusJakartaSans_800ExtraBold.ttf', weight: '800' },
  ],
});

export const metadata: Metadata = {
  title: { default: `${brand.name} · Panel`, template: `%s · ${brand.name}` },
  description: `Administración y panel de vendedores del marketplace ${brand.name}.`,
  robots: { index: false, follow: false },
};
export const viewport: Viewport = { themeColor: [{ media: '(prefers-color-scheme: light)', color: '#F8F7FC' }, { media: '(prefers-color-scheme: dark)', color: '#110F18' }] };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-VE" className={jakarta.variable}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
