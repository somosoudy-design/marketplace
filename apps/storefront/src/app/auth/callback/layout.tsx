import type { Metadata } from 'next';
import type { ReactNode } from 'react';

// A callback is a single browser transaction. Next must not cache the response at the edge.
export const dynamic = 'force-dynamic';
export const metadata: Metadata = { referrer: 'no-referrer' };

export default function CallbackLayout({ children }: { children: ReactNode }) {
  return children;
}
