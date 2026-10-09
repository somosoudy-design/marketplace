import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import { Providers } from '@/lib/providers';
import './globals.css';

const manrope = localFont({
  variable: '--font-manrope',
  display: 'swap',
  src: [
    { path: '../fonts/Manrope_400Regular.ttf', weight: '400' },
    { path: '../fonts/Manrope_500Medium.ttf', weight: '500' },
    { path: '../fonts/Manrope_600SemiBold.ttf', weight: '600' },
    { path: '../fonts/Manrope_700Bold.ttf', weight: '700' },
    { path: '../fonts/Manrope_800ExtraBold.ttf', weight: '800' },
  ],
});
const fraunces = localFont({ variable: '--font-fraunces', display: 'swap', src: [{ path: '../fonts/Fraunces_600SemiBold.ttf', weight: '600' }] });

export const metadata: Metadata = {
  title: { default: 'Kora · Panel', template: '%s · Kora' },
  description: 'Administración y panel de vendedores del marketplace Kora.',
  robots: { index: false, follow: false },
};
export const viewport: Viewport = { themeColor: [{ media: '(prefers-color-scheme: light)', color: '#F6F0E7' }, { media: '(prefers-color-scheme: dark)', color: '#121416' }] };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-VE" className={`${manrope.variable} ${fraunces.variable}`}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
