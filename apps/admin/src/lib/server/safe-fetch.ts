import 'server-only';
import { lookup as resolveNow, type LookupAddress } from 'node:dns';
import { lookup } from 'node:dns/promises';
import { isIP, type LookupFunction } from 'node:net';
import { Agent, fetch } from 'undici';

// Fetches public pages and images for the URL importer. Guards against SSRF: only http(s) on default ports,
// every DNS answer must be a public address, redirects are re-checked hop by hop, and the body is capped.
// The address is checked again at the moment of connecting (guardedLookup), because a hostile DNS server can
// answer with a public address for the first check and a private one for the connection (DNS rebinding).
const MAX_BYTES = 2_000_000;
const MAX_REDIRECTS = 3;

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

function isPrivate(ip: string): boolean {
  if (isIP(ip) === 4) return isPrivateV4(ip);
  const g = v6Groups(ip);
  const embeddedV4 = () => `${g[6]! >> 8}.${g[6]! & 255}.${g[7]! >> 8}.${g[7]! & 255}`;
  const zeros = (n: number) => g.slice(0, n).every((x) => x === 0);
  if (zeros(5) && g[5] === 0xffff) return isPrivateV4(embeddedV4()); // ::ffff:a.b.c.d (mapped)
  if (zeros(6)) return g[6] === 0 && g[7]! <= 1 ? true : isPrivateV4(embeddedV4()); // ::, ::1 and ::a.b.c.d (compatible)
  if (g[0] === 0x64 && g[1] === 0xff9b) return isPrivateV4(embeddedV4()); // NAT64
  const first = g[0]!;
  return (first & 0xfe00) === 0xfc00 // fc00::/7 unique local
    || (first & 0xffc0) === 0xfe80 // fe80::/10 link local
    || (first & 0xff00) === 0xff00 // multicast
    || first === 0x2001 && g[1] === 0x0db8 // documentation
    || first === 0x0100 && zeros(4); // discard-only
}

export async function assertPublicUrl(raw: string): Promise<URL> {
  const u = new URL(raw);
  if (u.protocol !== 'https:' && u.protocol !== 'http:') throw new Error('Solo se aceptan enlaces http(s).');
  if (u.port && u.port !== '80' && u.port !== '443') throw new Error('Puerto no permitido.');
  if (u.username || u.password) throw new Error('El enlace no puede incluir credenciales.');
  const host = u.hostname.replace(/^\[|\]$/g, '');
  const addrs = isIP(host) ? [{ address: host }] : await lookup(host, { all: true, verbatim: true });
  if (!addrs.length || addrs.some((a) => isPrivate(a.address))) throw new Error('Dirección no permitida.');
  return u;
}

const PRIVATE_ADDRESS = 'EPRIVATEADDR';

/** Resolves a hostname for a socket like the OS does, but refuses the connection if any answer is private. */
export const guardedLookup: LookupFunction = (hostname, options, callback) => {
  resolveNow(hostname, { ...options, all: true }, (err, answers) => {
    const list = (answers ?? []) as LookupAddress[];
    if (err) return callback(err, '', 0);
    if (!list.length || list.some((a) => isPrivate(a.address))) {
      return callback(Object.assign(new Error('Dirección no permitida.'), { code: PRIVATE_ADDRESS }), '', 0);
    }
    if (options.all) return callback(null, list);
    return callback(null, list[0]!.address, list[0]!.family);
  });
};

// every importer request connects through this agent, so no socket can open towards a private address
export const importerAgent = new Agent({ connect: { lookup: guardedLookup }, connections: 8, keepAliveTimeout: 4_000 });

async function fetchPublic(raw: string, opts: { accept: string; types: RegExp; maxBytes: number; truncate: boolean; kind: string }) {
  let url = (await assertPublicUrl(raw)).toString();
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const res = await fetch(url, {
      dispatcher: importerAgent,
      redirect: 'manual',
      signal: AbortSignal.timeout(10_000),
      headers: { accept: opts.accept, 'user-agent': 'KoraImporter/1.0 (+https://kora.example.com; metadatos para vista previa)' },
    });
    if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
      url = (await assertPublicUrl(new URL(res.headers.get('location')!, url).toString())).toString();
      continue;
    }
    if (!res.ok) throw new Error(`${opts.kind} respondió ${res.status}.`);
    const type = (res.headers.get('content-type') ?? '').split(';')[0]!.trim().toLowerCase();
    if (!opts.types.test(type)) throw new Error(`${opts.kind}: tipo de contenido no admitido (${type || 'desconocido'}).`);
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
    return { url, type, bytes: Buffer.concat(chunks) };
  }
  throw new Error('Demasiadas redirecciones.');
}

/** One HTML page, truncated at 2 MB (metadata lives in the head). */
export async function fetchPublicPage(raw: string): Promise<{ url: string; html: string }> {
  const r = await fetchPublic(raw, { accept: 'text/html,application/xhtml+xml', types: /^(text\/html|application\/xhtml\+xml)$/, maxBytes: MAX_BYTES, truncate: true, kind: 'La página' });
  return { url: r.url, html: new TextDecoder().decode(r.bytes) };
}

/** One image the admin confirmed the rights to, in a format the catalog bucket accepts (max 5 MB). */
export async function fetchPublicImage(raw: string): Promise<{ type: 'image/jpeg' | 'image/png' | 'image/webp'; ext: string; bytes: Buffer }> {
  const r = await fetchPublic(raw, { accept: 'image/webp,image/jpeg,image/png', types: /^image\/(jpeg|png|webp)$/, maxBytes: 5 * 1024 * 1024, truncate: false, kind: 'La imagen' });
  const type = r.type as 'image/jpeg' | 'image/png' | 'image/webp';
  return { type, ext: { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[type], bytes: r.bytes };
}

/** Spanish copy for network failures (DNS, refused connections, timeouts) instead of raw Node error codes. */
export function fetchErrorMessage(e: unknown, fallback: string): string {
  if (!(e instanceof Error)) return fallback;
  const code = (e as { code?: string; cause?: { code?: string } }).code ?? (e as { cause?: { code?: string } }).cause?.code ?? '';
  if (code === PRIVATE_ADDRESS) return 'Dirección no permitida.';
  if (e.name === 'TimeoutError' || code === 'UND_ERR_CONNECT_TIMEOUT') return 'El sitio tardó demasiado en responder.';
  if (code === 'ENOTFOUND' || code === 'EAI_AGAIN' || /ENOTFOUND|EAI_AGAIN/.test(e.message)) return 'No encontramos ese sitio. Revisa el enlace.';
  if (/ECONNREFUSED|ECONNRESET|fetch failed/.test(code + e.message)) return 'El sitio rechazó la conexión.';
  return e.message || fallback;
}
