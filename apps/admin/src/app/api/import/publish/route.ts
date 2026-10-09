import { ERROR_MESSAGES, toAppError } from '@kora/core';
import { fetchErrorMessage, fetchPublicImage } from '@/lib/server/safe-fetch';
import { requireAdmin } from '@/lib/server/supabase';

export const dynamic = 'force-dynamic';

interface Body {
  importId?: string;
  product?: Record<string, unknown>;
  variants?: Array<{ title?: string; sku?: string; price_usd?: string | number }>;
  images?: Array<{ url?: string; path?: string; alt?: string; rightsConfirmed?: boolean }>;
}

/**
 * Turns a reviewed import into a product pending moderation. Only images the admin explicitly confirmed
 * the rights to are copied into our catalog bucket (we never hotlink the source). The product, variants,
 * images and the import status change are written by one database function in a single transaction.
 */
export async function POST(req: Request) {
  const auth = await requireAdmin(req);
  if ('error' in auth) return auth.error;
  const { sb } = auth;
  const body = (await req.json().catch(() => ({}))) as Body;
  const storeId = String(body.product?.store_id ?? '');
  if (!body.importId || !/^[0-9a-f-]{36}$/.test(storeId)) return Response.json({ error: 'Faltan datos del producto.' }, { status: 400 });
  const images = body.images ?? [];
  if (images.length > 8) return Response.json({ error: 'Máximo 8 imágenes.' }, { status: 400 });
  if (images.some((i) => i.rightsConfirmed !== true)) return Response.json({ error: ERROR_MESSAGES.image_rights_required }, { status: 400 });

  const { data: imp, error: impErr } = await sb.from('url_imports').select('id, status').eq('id', body.importId).maybeSingle();
  if (impErr || !imp) return Response.json({ error: 'Importación no encontrada.' }, { status: 404 });
  if (imp.status === 'published') return Response.json({ error: ERROR_MESSAGES.already_processed }, { status: 409 });

  const stored: Array<{ path: string; alt: string | null; rights_confirmed: true }> = [];
  for (const [n, img] of images.entries()) {
    if (img.path) {
      stored.push({ path: img.path, alt: img.alt ?? null, rights_confirmed: true });
      continue;
    }
    try {
      const file = await fetchPublicImage(String(img.url ?? ''));
      const path = `${storeId}/imports/${imp.id}/${n}.${file.ext}`;
      const { error } = await sb.storage.from('catalog').upload(path, file.bytes, { contentType: file.type, upsert: true });
      if (error) throw new Error(error.message);
      stored.push({ path, alt: img.alt ?? null, rights_confirmed: true });
    } catch (e) {
      return Response.json({ error: `Imagen ${n + 1}: ${fetchErrorMessage(e, 'no se pudo copiar.')}` }, { status: 422 });
    }
  }

  const { data, error } = await sb.rpc('publish_import', {
    p_import_id: imp.id,
    p_product: body.product as never,
    p_variants: (body.variants ?? []) as never,
    p_images: stored as never,
  });
  if (error) {
    const e = toAppError(error);
    return Response.json({ error: e.message, hint: e.code }, { status: 400 });
  }
  return Response.json({ productId: data });
}
