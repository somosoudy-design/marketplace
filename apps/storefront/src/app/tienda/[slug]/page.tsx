import { notFound, redirect } from 'next/navigation';
import { publicApi } from '@/lib/server';
import { Failure } from '@/components/states';

export const dynamic = 'force-dynamic';

/** Shared app links remain usable on the web while the store uses the existing catalog view. */
export default async function StoreLink({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  let store;
  try {
    store = await publicApi().catalog.store(slug);
  } catch {
    return <Failure href={`/tienda/${encodeURIComponent(slug)}`} message="No pudimos cargar esta tienda." />;
  }
  if (!store) notFound();
  redirect(`/buscar?${new URLSearchParams({ store: store.slug })}`);
}
