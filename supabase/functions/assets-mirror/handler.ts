// POST /functions/v1/assets-mirror   (service role or the Vault job token: invoke_edge_function from SQL)
// One-time move of the demo catalog images from the public GitHub repository to Supabase Storage, so the
// repository can become private (docs/ESTADO_ACTUAL.md). Body: {"items": [{"bucket": "catalog" | "stores",
// "path": "demo/<file>", "source": "https://raw.githubusercontent.com/somosoudy-design/marketplace/<sha>/…"}]}.
// Only files of this repository are fetched (no other host, no redirects), only into the demo folders, and only
// images. Answers what was copied; the SQL that points the rows to Storage runs afterwards, by hand.
import { isServiceCaller } from '../_shared/auth.ts';
import { defaultDeps, type Deps } from '../_shared/env.ts';
import { cors, fail, json, readJson } from '../_shared/http.ts';

export const SOURCE_PREFIX = 'https://raw.githubusercontent.com/somosoudy-design/marketplace/';
const PATH = /^demo\/[a-z0-9][a-z0-9._-]{0,120}\.(webp|png|jpe?g)$/;
const TYPES: Record<string, string> = { webp: 'image/webp', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg' };
const MAX_ITEMS = 40;
const MAX_BYTES = 5 * 1024 * 1024;

export interface MirrorItem { bucket: string; path: string; source: string }
export interface MirrorResult { bucket: string; path: string; ok: boolean; bytes?: number; error?: string }

export function createHandler(deps: Deps = defaultDeps()) {
  return async (req: Request): Promise<Response> => {
    if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
    if (req.method !== 'POST') return fail(405, 'method_not_allowed', 'Usa POST.');
    if (!(await isServiceCaller(req, deps.env))) return fail(401, 'unauthorized', 'Solo para tareas del servidor.');
    const body = await readJson<{ items?: MirrorItem[] }>(req);
    const items = body?.items ?? [];
    if (!Array.isArray(items) || !items.length || items.length > MAX_ITEMS) return fail(400, 'invalid_input', `Entre 1 y ${MAX_ITEMS} archivos por llamada.`);

    const url = deps.env('SUPABASE_URL')!;
    const key = deps.env('SUPABASE_SERVICE_ROLE_KEY')!;
    const auth: Record<string, string> = key.split('.').length === 3 ? { apikey: key, authorization: `Bearer ${key}` } : { apikey: key };
    const results: MirrorResult[] = [];
    for (const it of items) {
      const done = (r: Partial<MirrorResult>) => results.push({ bucket: it.bucket, path: it.path, ok: false, ...r });
      if (!['catalog', 'stores'].includes(it.bucket) || !PATH.test(it.path ?? '')) { done({ error: 'destino no permitido' }); continue; }
      if (typeof it.source !== 'string' || !it.source.startsWith(SOURCE_PREFIX) || it.source.includes('..')) { done({ error: 'origen no permitido' }); continue; }
      try {
        const src = await deps.fetch(it.source, { redirect: 'error', signal: AbortSignal.timeout(15_000) });
        if (!src.ok) { done({ error: `origen respondió ${src.status}` }); continue; }
        const bytes = new Uint8Array(await src.arrayBuffer());
        if (!bytes.length || bytes.length > MAX_BYTES) { done({ error: 'tamaño no permitido' }); continue; }
        const ext = it.path.split('.').pop()!;
        const up = await fetch(`${url}/storage/v1/object/${it.bucket}/${it.path}`, {
          method: 'POST',
          headers: { ...auth, 'content-type': TYPES[ext]!, 'x-upsert': 'true', 'cache-control': 'max-age=31536000' },
          body: bytes,
        });
        if (!up.ok) { done({ error: `Storage respondió ${up.status}: ${(await up.text()).slice(0, 120)}` }); continue; }
        results.push({ bucket: it.bucket, path: it.path, ok: true, bytes: bytes.length });
      } catch (e) {
        done({ error: (e as Error).message.slice(0, 160) });
      }
    }
    return json({ copied: results.filter((r) => r.ok).length, failed: results.filter((r) => !r.ok).length, results });
  };
}
