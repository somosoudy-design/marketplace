import { createServer } from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// No mocks: proves that undici really routes the socket's DNS resolution through guardedLookup, so a name that
// resolves to a private address cannot be reached even when the first check is skipped or fooled.
const { importerAgent } = await import('@/lib/server/safe-fetch');
const { fetch } = await import('undici');

const server = createServer((_req, res) => res.end('interno'));
let port = 0;
beforeAll(() => new Promise<void>((done) => server.listen(0, '127.0.0.1', () => { port = (server.address() as { port: number }).port; done(); })));
afterAll(() => new Promise<void>((done) => server.close(() => done())));

describe('importer agent', () => {
  it('never opens a socket to a name that resolves to a private address', async () => {
    const plain = await fetch(`http://localhost:${port}/`);
    expect(await plain.text()).toBe('interno'); // the server is reachable without the guard
    const err = await fetch(`http://localhost:${port}/`, { dispatcher: importerAgent }).catch((e: Error & { cause?: { code?: string } }) => e);
    expect(err).toBeInstanceOf(Error);
    expect((err as { cause?: { code?: string } }).cause?.code).toBe('EPRIVATEADDR');
  });
});
