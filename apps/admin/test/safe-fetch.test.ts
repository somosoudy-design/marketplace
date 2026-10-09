import { beforeEach, describe, expect, it, vi } from 'vitest';

// DNS answers per host: public hosts resolve to documentation-range-free public IPs, "interno" to a private one.
vi.mock('node:dns/promises', () => ({
  lookup: vi.fn(async (host: string) => {
    const table: Record<string, string[]> = {
      'tienda.example.com': ['93.184.215.14'],
      'cdn.example.com': ['93.184.215.15'],
      'interno.example.com': ['10.0.0.8'],
      'mixto.example.com': ['93.184.215.16', '127.0.0.1'],
      'v6.example.com': ['fd00::1'],
    };
    const ips = table[host];
    if (!ips) throw Object.assign(new Error(`getaddrinfo ENOTFOUND ${host}`), { code: 'ENOTFOUND' });
    return ips.map((address) => ({ address, family: address.includes(':') ? 6 : 4 }));
  }),
}));

const { assertPublicUrl, fetchErrorMessage, fetchPublicImage, fetchPublicPage } = await import('@/lib/server/safe-fetch');

const fetchMock = vi.fn();
beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});
const reply = (body: BodyInit | null, init: ResponseInit) => new Response(body, init);

describe('assertPublicUrl', () => {
  it('accepts public http(s) hosts on default ports', async () => {
    await expect(assertPublicUrl('https://tienda.example.com/p/1')).resolves.toBeInstanceOf(URL);
    await expect(assertPublicUrl('http://tienda.example.com:80/p/1')).resolves.toBeInstanceOf(URL);
    await expect(assertPublicUrl('http://[2606:4700::6810:84e5]/x')).resolves.toBeInstanceOf(URL);
    await expect(assertPublicUrl('http://[::ffff:93.184.215.14]/x')).resolves.toBeInstanceOf(URL);
  });

  it.each([
    ['file:///etc/passwd', 'Solo se aceptan'],
    ['ftp://tienda.example.com/x', 'Solo se aceptan'],
    ['https://tienda.example.com:8443/x', 'Puerto'],
    ['https://user:pw@tienda.example.com/x', 'credenciales'],
    ['http://127.0.0.1/x', 'no permitida'],
    ['http://169.254.169.254/latest/meta-data', 'no permitida'],
    ['http://[::1]/x', 'no permitida'],
    ['http://[::ffff:10.0.0.1]/x', 'no permitida'],
    ['http://[::ffff:7f00:1]/x', 'no permitida'],
    ['http://[64:ff9b::a9fe:a9fe]/x', 'no permitida'],
    ['http://[fe80::1]/x', 'no permitida'],
    ['http://[::]/x', 'no permitida'],
    ['https://interno.example.com/x', 'no permitida'],
    ['https://mixto.example.com/x', 'no permitida'],
    ['https://v6.example.com/x', 'no permitida'],
  ])('rejects %s', async (url, msg) => {
    await expect(assertPublicUrl(url)).rejects.toThrow(msg);
  });
});

describe('fetchPublicPage', () => {
  it('follows a redirect only to another public address', async () => {
    fetchMock
      .mockResolvedValueOnce(reply(null, { status: 302, headers: { location: 'https://cdn.example.com/p' } }))
      .mockResolvedValueOnce(reply('<html><title>Hola</title></html>', { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } }));
    await expect(fetchPublicPage('https://tienda.example.com/p')).resolves.toEqual({ url: 'https://cdn.example.com/p', html: '<html><title>Hola</title></html>' });
    expect(fetchMock.mock.calls[0]![1]).toMatchObject({ redirect: 'manual' });
  });

  it('refuses a redirect into the private network', async () => {
    fetchMock.mockResolvedValueOnce(reply(null, { status: 301, headers: { location: 'http://interno.example.com/admin' } }));
    await expect(fetchPublicPage('https://tienda.example.com/p')).rejects.toThrow('no permitida');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('gives up after three redirects', async () => {
    fetchMock.mockImplementation(async () => reply(null, { status: 302, headers: { location: 'https://tienda.example.com/otra' } }));
    await expect(fetchPublicPage('https://tienda.example.com/p')).rejects.toThrow('Demasiadas redirecciones');
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it('only reads HTML and caps the body', async () => {
    fetchMock.mockResolvedValueOnce(reply('{}', { status: 200, headers: { 'content-type': 'application/json' } }));
    await expect(fetchPublicPage('https://tienda.example.com/p')).rejects.toThrow('tipo de contenido');
    fetchMock.mockResolvedValueOnce(reply('a'.repeat(2_500_000), { status: 200, headers: { 'content-type': 'text/html' } }));
    const page = await fetchPublicPage('https://tienda.example.com/p');
    expect(page.html.length).toBeLessThanOrEqual(2_000_000);
  });
});

describe('fetchPublicImage', () => {
  it('accepts jpeg/png/webp and names the extension', async () => {
    fetchMock.mockResolvedValueOnce(reply(new Uint8Array([0xff, 0xd8, 0xff]), { status: 200, headers: { 'content-type': 'image/jpeg' } }));
    const img = await fetchPublicImage('https://cdn.example.com/a.jpg');
    expect(img).toMatchObject({ type: 'image/jpeg', ext: 'jpg' });
    expect(img.bytes.length).toBe(3);
  });

  it('rejects other types and files over 5 MB instead of truncating them', async () => {
    fetchMock.mockResolvedValueOnce(reply('<svg/>', { status: 200, headers: { 'content-type': 'image/svg+xml' } }));
    await expect(fetchPublicImage('https://cdn.example.com/a.svg')).rejects.toThrow('tipo de contenido');
    fetchMock.mockResolvedValueOnce(reply(new Uint8Array(5 * 1024 * 1024 + 1), { status: 200, headers: { 'content-type': 'image/png' } }));
    await expect(fetchPublicImage('https://cdn.example.com/a.png')).rejects.toThrow('tamaño');
  });
});

describe('fetchErrorMessage', () => {
  it('translates network failures', () => {
    expect(fetchErrorMessage(Object.assign(new Error('getaddrinfo ENOTFOUND x'), { code: 'ENOTFOUND' }), '')).toBe('No encontramos ese sitio. Revisa el enlace.');
    expect(fetchErrorMessage(Object.assign(new Error('timeout'), { name: 'TimeoutError' }), '')).toBe('El sitio tardó demasiado en responder.');
    expect(fetchErrorMessage(new TypeError('fetch failed'), '')).toBe('El sitio rechazó la conexión.');
  });
});
