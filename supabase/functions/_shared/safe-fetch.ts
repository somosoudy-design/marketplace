// Fetches public pages and images for the URL importer of the hosted panel (panel-api), with the same rules as the
// panel's own server (apps/admin/src/lib/server/safe-fetch.ts): only http(s) on default ports, no credentials in
// the address, every DNS answer must be a public address, redirects are checked again hop by hop and the body is
// capped. Deno's fetch resolves the name again when it connects and cannot be pinned to the address checked here,
// so a hostile DNS server could still answer differently a moment later (DNS rebinding); the edge runtime only
// reaches the public internet, and the importer is reserved to admins.

/** Resolver for the check; injected in tests. Returns every A and AAAA answer. */
export type Resolve = (host: string) => Promise<string[]>;

export const denoResolve: Resolve = async (host) => {
  const answers = await Promise.allSettled([Deno.resolveDns(host, 'A'), Deno.resolveDns(host, 'AAAA')]);
  const found = answers.flatMap((a) => (a.status === 'fulfilled' ? a.value : []));
  if (!found.length) throw Object.assign(new Error('No encontramos ese sitio. Revisa el enlace.'), { code: 'ENOTFOUND' });
  return found;
};

const MAX_REDIRECTS = 3;
const PRIVATE_ADDRESS = 'EPRIVATEADDR';

const isV4 = (ip: string) => /^\d{1,3}(\.\d{1,3}){3}$/.test(ip) && ip.split('.').every((n) => Number(n) <= 255);
const isV6 = (ip: string) => ip.includes(':') && /^[0-9a-f:.%]+$/i.test(ip);

function isPrivateV4(ip: string): boolean {
  const [a, b] = ip.split('.').map(Number) as [number, number];
  return a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && b === 168) || (a === 192 && b === 0) || (a === 198 && (b === 18 || b === 19)) || a >= 224;
}

/** Eight 16-bit groups, accepting "::" compression and a trailing dotted IPv4. */
function v6Groups(ip: string): number[] {
  let v = ip.toLowerCase().split('%')[0]!;
  const dotted = v.match(/(\d+\.\d+\.\d+\.\d+)$/);
  if (dotted) {
    const [a, b, c, d] = dotted[1]!.split('.').map(Number) as [number, number, number, number];
    v = v.slice(0, -dotted[1]!.length) + ((a << 8) | b).toString(16) + ':' + ((c << 8) | d).toString(16);
  }
  const [head, tail] = v.split('::') as [string, string | undefined];
  const h = head ? head.split(':') : [];
  const t = tail ? tail.split(':') : [];
  const groups = tail === undefined ? h : [...h, ...Array(8 - h.length - t.length).fill('0'), ...t];
  return groups.map((g) => parseInt(g || '0', 16));
}

export function isPrivateAddress(ip: string): boolean {
  if (isV4(ip)) return isPrivateV4(ip);
  if (!isV6(ip)) return true; // not an address we understand: refuse
  const g = v6Groups(ip);
  const embeddedV4 = () => `${g[6]! >> 8}.${g[6]! & 255}.${g[7]! >> 8}.${g[7]! & 255}`;
  const zeros = (n: number) => g.slice(0, n).every((x) => x === 0);
  if (zeros(5) && g[5] === 0xffff) return isPrivateV4(embeddedV4()); // ::ffff:a.b.c.d (mapped)
  if (zeros(6)) return g[6] === 0 && g[7]! <= 1 ? true : isPrivateV4(embeddedV4()); // ::, ::1 and ::a.b.c.d
  if (g[0] === 0x64 && g[1] === 0xff9b) return isPrivateV4(embeddedV4()); // NAT64
  const first = g[0]!;
  return (first & 0xfe00) === 0xfc00 || (first & 0xffc0) === 0xfe80 || (first & 0xff00) === 0xff00
    || (first === 0x2001 && g[1] === 0x0db8) || (first === 0x0100 && zeros(4));
}

export async function assertPublicUrl(raw: string, resolve: Resolve): Promise<URL> {
  const u = new URL(raw);
  if (u.protocol !== 'https:' && u.protocol !== 'http:') throw new Error('Solo se aceptan enlaces http(s).');
  if (u.port && u.port !== '80' && u.port !== '443') throw new Error('Puerto no permitido.');
  if (u.username || u.password) throw new Error('El enlace no puede incluir credenciales.');
  const host = u.hostname.replace(/^\[|\]$/g, '');
  const addrs = isV4(host) || isV6(host) ? [host] : await resolve(host);
  if (!addrs.length || addrs.some(isPrivateAddress)) throw Object.assign(new Error('Dirección no permitida.'), { code: PRIVATE_ADDRESS });
  return u;
}

interface Opts { accept: string; types: RegExp; maxBytes: number; truncate: boolean; kind: string }

async function fetchPublic(raw: string, opts: Opts, deps: { fetch: typeof fetch; resolve: Resolve }) {
  let url = (await assertPublicUrl(raw, deps.resolve)).toString();
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const res = await deps.fetch(url, {
      redirect: 'manual',
      signal: AbortSignal.timeout(10_000),
      headers: { accept: opts.accept, 'user-agent': 'KoraImporter/1.0 (+https://kora.example.com; metadatos para vista previa)' },
    });
    if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
      await res.body?.cancel();
      url = (await assertPublicUrl(new URL(res.headers.get('location')!, url).toString(), deps.resolve)).toString();
      continue;
    }
    if (!res.ok) {
      await res.body?.cancel();
      throw new Error(`${opts.kind} respondió ${res.status}.`);
    }
    const type = (res.headers.get('content-type') ?? '').split(';')[0]!.trim().toLowerCase();
    if (!opts.types.test(type)) {
      await res.body?.cancel();
      throw new Error(`${opts.kind}: tipo de contenido no admitido (${type || 'desconocido'}).`);
    }
    const reader = res.body?.getReader();
    if (!reader) throw new Error('Respuesta vacía.');
    const chunks: Uint8Array[] = [];
    let size = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > opts.maxBytes) {
        await reader.cancel();
        if (!opts.truncate) throw new Error(`${opts.kind}: el archivo supera el tamaño permitido.`);
        break;
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(Math.min(size, opts.maxBytes));
    let at = 0;
    for (const c of chunks) {
      bytes.set(c.subarray(0, bytes.length - at), at);
      at += Math.min(c.byteLength, bytes.length - at);
    }
    return { url, type, bytes };
  }
  throw new Error('Demasiadas redirecciones.');
}

/** One HTML page, truncated at 2 MB (metadata lives in the head). */
export async function fetchPublicPage(raw: string, deps: { fetch: typeof fetch; resolve: Resolve }): Promise<{ url: string; html: string }> {
  const r = await fetchPublic(raw, { accept: 'text/html,application/xhtml+xml', types: /^(text\/html|application\/xhtml\+xml)$/, maxBytes: 2_000_000, truncate: true, kind: 'La página' }, deps);
  return { url: r.url, html: new TextDecoder().decode(r.bytes) };
}

/** One image the admin confirmed the rights to, in a format the catalog bucket accepts (max 5 MB). */
export async function fetchPublicImage(raw: string, deps: { fetch: typeof fetch; resolve: Resolve }): Promise<{ type: string; ext: string; bytes: Uint8Array<ArrayBuffer> }> {
  const r = await fetchPublic(raw, { accept: 'image/webp,image/jpeg,image/png', types: /^image\/(jpeg|png|webp)$/, maxBytes: 5 * 1024 * 1024, truncate: false, kind: 'La imagen' }, deps);
  return { type: r.type, ext: ({ 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' } as Record<string, string>)[r.type]!, bytes: r.bytes };
}

/** Spanish copy for network failures instead of raw runtime errors. */
export function fetchErrorMessage(e: unknown, fallback: string): string {
  if (!(e instanceof Error)) return fallback;
  const code = (e as { code?: string }).code ?? '';
  if (code === PRIVATE_ADDRESS) return 'Dirección no permitida.';
  if (code === 'ENOTFOUND') return 'No encontramos ese sitio. Revisa el enlace.';
  if (e.name === 'TimeoutError' || e.name === 'AbortError') return 'El sitio tardó demasiado en responder.';
  if (/dns error|failed to lookup|Name or service not known|No address associated/i.test(e.message)) return 'No encontramos ese sitio. Revisa el enlace.';
  if (/connection refused|connection reset|error sending request|tcp connect error/i.test(e.message)) return 'El sitio rechazó la conexión.';
  return e.message || fallback;
}
