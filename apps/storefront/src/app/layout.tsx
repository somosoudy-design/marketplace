import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import { Providers } from '@/lib/providers';
import { Shell } from '@/components/shell';
import { brand } from '@/lib/format';
import './globals.css';
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
  title: { default: `${brand.name} · Encuentra lo que buscas`, template: `%s · ${brand.name}` },
  description: brand.tagline,
  robots: { index: false, follow: false },
};
export const viewport: Viewport = { themeColor: '#6D42E8' };
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html data-scroll-behavior="smooth" lang="es-VE" className={jakarta.variable}>
      <body>
        <Providers>
          <Shell>{children}</Shell>
        </Providers>
      </body>
    </html>
  );
}
