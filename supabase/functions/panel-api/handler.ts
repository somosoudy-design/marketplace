// POST /functions/v1/panel-api/<action>   (an admin's session; verify_jwt on)
// The hosted panel is a static site (apps/admin built with KORA_PANEL_EXPORT=1), so the three actions its own Next
// server answers under /api/* run here instead, with the same rules and always as the calling admin: the database
// decides with that admin's token (RLS and functions), never with the service role.
//   /import          reads the metadata of one public product page (providers that forbid it stay manual)
//   /import/publish  copies the images the admin confirmed the rights to and creates the product in moderation
//   /rates/sync      "Consultar ahora" of the rates screen: reads every enabled source once and stores it
import { detectProvider, extractProductMetadata } from '../_shared/core/import.ts';
import { ERROR_MESSAGES, toAppError } from '../_shared/core/errors.ts';
import { isRateAdapter, rateReadError, readRateSource } from '../_shared/core/rates.ts';
import { defaultDeps, type Deps } from '../_shared/env.ts';
import { bearer, cors, json, readJson } from '../_shared/http.ts';
import { rest, RestError, type Rest } from '../_shared/rest.ts';
import { denoResolve, fetchErrorMessage, fetchPublicImage, fetchPublicPage, type Resolve } from '../_shared/safe-fetch.ts';

export interface PanelDeps extends Deps {
  /** DNS answers for the importer's address check; injected in tests. */
  resolve: Resolve;
}
export const defaultPanelDeps = (): PanelDeps => ({ ...defaultDeps(), resolve: denoResolve });

// the panel shows `error` as is (apps/admin/src/lib/kora.ts apiPost)
const error = (status: number, message: string, hint?: string) => json({ error: message, ...(hint ? { hint } : {}) }, status);

type ImportRow = { id: string; status: string };
interface PublishBody {
  importId?: string;
  product?: Record<string, unknown>;
  variants?: Array<{ title?: string; sku?: string; price_usd?: string | number }>;
  images?: Array<{ url?: string; path?: string; alt?: string; rightsConfirmed?: boolean }>;
}

export function createHandler(deps: PanelDeps = defaultPanelDeps()) {
  return async (req: Request): Promise<Response> => {
    if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
    if (req.method !== 'POST') return error(405, 'Usa POST.');
    const action = new URL(req.url).pathname.replace(/^.*?\/panel-api/, '').replace(/\/$/, '');
    const token = bearer(req);
    if (!token) return error(401, 'auth_required');
    const db = rest(deps.env);
    const admin = await db.rpc<boolean>('is_admin', {}, { as: token }).catch(() => false);
    if (admin !== true) return error(403, 'admin_required');

    if (action === '/import') return importPage(req, db, token, deps);
    if (action === '/import/publish') return publish(req, db, token, deps);
    if (action === '/rates/sync') return syncRates(db, token, deps);
    return error(404, 'Acción desconocida.');
  };
}

async function importPage(req: Request, db: Rest, as: string, deps: PanelDeps): Promise<Response> {
  const { url } = (await readJson<{ url?: string }>(req)) ?? {};
  let provider;
  try {
    provider = detectProvider(String(url ?? ''));
  } catch (e) {
    return error(400, (e as Error).message);
  }
  let row: ImportRow;
  try {
    row = await db.insert<ImportRow>('url_imports', { url: provider.url, provider: provider.key, status: 'pending' }, { as });
  } catch (e) {
    return error(500, (e as Error).message);
  }
  const finish = async (patch: Record<string, unknown>) => {
    const updated = await db.update<unknown>(`url_imports?id=eq.${row.id}`, patch, { as });
    return json({ import: updated, provider });
  };
  if (provider.policy === 'manual') return finish({ status: 'manual_required', message: provider.note });
  try {
    const page = await fetchPublicPage(provider.url, deps);
    const extracted = extractProductMetadata(page.html, page.url);
    if (!extracted.title) return finish({ status: 'failed', message: 'La página no publica datos de producto legibles. Cárgalo manualmente.', extracted });
    return finish({ status: 'extracted', extracted, message: provider.note });
  } catch (e) {
    return finish({ status: 'failed', message: fetchErrorMessage(e, 'No se pudo leer la página.') });
  }
}

async function publish(req: Request, db: Rest, as: string, deps: PanelDeps): Promise<Response> {
  const body = (await readJson<PublishBody>(req)) ?? {};
  const storeId = String(body.product?.store_id ?? '');
  if (!body.importId || !/^[0-9a-f-]{36}$/.test(body.importId) || !/^[0-9a-f-]{36}$/.test(storeId)) return error(400, 'Faltan datos del producto.');
  const images = body.images ?? [];
  if (images.length > 8) return error(400, 'Máximo 8 imágenes.');
  if (images.some((i) => i.rightsConfirmed !== true)) return error(400, ERROR_MESSAGES.image_rights_required!);

  const [imp] = await db.get<ImportRow[]>(`url_imports?select=id,status&id=eq.${body.importId}`, { as }).catch(() => [] as ImportRow[]);
  if (!imp) return error(404, 'Importación no encontrada.');
  if (imp.status === 'published') return error(409, ERROR_MESSAGES.already_processed!);

  const stored: Array<{ path: string; alt: string | null; rights_confirmed: true }> = [];
  for (const [n, img] of images.entries()) {
    if (img.path) {
      stored.push({ path: img.path, alt: img.alt ?? null, rights_confirmed: true });
      continue;
    }
    try {
      const file = await fetchPublicImage(String(img.url ?? ''), deps);
      const path = `${storeId}/imports/${imp.id}/${n}.${file.ext}`;
      await upload(deps, as, 'catalog', path, file.bytes, file.type);
      stored.push({ path, alt: img.alt ?? null, rights_confirmed: true });
    } catch (e) {
      return error(422, `Imagen ${n + 1}: ${fetchErrorMessage(e, 'no se pudo copiar.')}`);
    }
  }

  try {
    const productId = await db.rpc<string>('publish_import', { p_import_id: imp.id, p_product: body.product, p_variants: body.variants ?? [], p_images: stored }, { as });
    return json({ productId });
  } catch (e) {
    const app = toAppError(e instanceof RestError ? { hint: e.hint ?? undefined, code: e.code ?? undefined, message: e.message, details: e.details ?? undefined } : e);
    return error(400, app.message, app.code);
  }
}

/** Uploads to Storage as the admin: the bucket's policies decide, as they do for the panel's own server. */
async function upload(deps: PanelDeps, as: string, bucket: string, path: string, bytes: Uint8Array<ArrayBuffer>, type: string) {
  const url = deps.env('SUPABASE_URL');
  const anon = deps.env('SUPABASE_ANON_KEY');
  const res = await fetch(`${url}/storage/v1/object/${bucket}/${path}`, {
    method: 'POST',
    headers: { authorization: `Bearer ${as}`, ...(anon ? { apikey: anon } : {}), 'content-type': type, 'x-upsert': 'true' },
    body: bytes,
  });
  if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { message?: string }).message ?? `Storage respondió ${res.status}.`);
}

async function syncRates(db: Rest, as: string, deps: PanelDeps): Promise<Response> {
  const sources = await db.get<{ code: string; adapter: string }[]>('exchange_rate_sources?select=code,adapter&enabled=eq.true&order=code', { as });
  const userAgent = deps.env('RATES_USER_AGENT') ?? 'KoraRates/1.0';
  const results = await Promise.all(
    sources.filter((s) => isRateAdapter(s.adapter)).map(async (s) => {
      try {
        const obs = await readRateSource(s.adapter as Parameters<typeof readRateSource>[0], s.code, { fetch: deps.fetch, userAgent });
        await db.rpc('ingest_rate', { p_source: s.code, p_pair: obs.pair, p_rate: obs.rate, p_observed_at: obs.observedAt, p_raw: obs.raw ?? null }, { as });
        return { source: s.code, ok: true, pair: obs.pair, rate: obs.rate, observedAt: obs.observedAt };
      } catch (e) {
        return { source: s.code, ok: false, error: rateReadError(e) };
      }
    }),
  );
  return json({ results });
}
