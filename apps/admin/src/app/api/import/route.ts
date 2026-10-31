import { detectProvider, extractProductMetadata } from '@kora/core/import';
import { fetchErrorMessage, fetchPublicPage } from '@/lib/server/safe-fetch';
import { requireAdmin } from '@/lib/server/supabase';

export const dynamic = 'force-dynamic';

/**
 * Admin URL import. Reads only the single page the admin pasted, and only the metadata it publishes for
 * link previews. Providers whose terms forbid automated extraction are recorded as manual and never fetched.
 * Nothing is published here: the admin reviews the draft, sets our price and confirms image rights.
 */
export async function POST(req: Request) {
  const auth = await requireAdmin(req);
  if ('error' in auth) return auth.error;
  const { sb } = auth;
  const { url } = (await req.json().catch(() => ({}))) as { url?: string };
  let provider;
  try {
    provider = detectProvider(String(url ?? ''));
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 400 });
  }
  const { data: row, error } = await sb.from('url_imports').insert({ url: provider.url, provider: provider.key, status: 'pending' }).select().single();
  if (error) return Response.json({ error: error.message }, { status: 500 });

  const finish = async (patch: Record<string, unknown>) => {
    const { data } = await sb.from('url_imports').update(patch).eq('id', row.id).select().single();
    return Response.json({ import: data, provider });
  };
  if (provider.policy === 'manual') return finish({ status: 'manual_required', message: provider.note });
  try {
    const page = await fetchPublicPage(provider.url);
    const extracted = extractProductMetadata(page.html, page.url);
    if (!extracted.title) return finish({ status: 'failed', message: 'La página no publica datos de producto legibles. Cárgalo manualmente.', extracted });
    return finish({ status: 'extracted', extracted, message: provider.note });
  } catch (e) {
    return finish({ status: 'failed', message: fetchErrorMessage(e, 'No se pudo leer la página.') });
  }
}
