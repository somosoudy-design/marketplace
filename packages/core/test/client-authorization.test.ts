import { expect, it } from 'vitest';
import { createKoraClient } from '../../api/src/client';

it('keeps a delayed operation on the token captured when its client was created', async () => {
  const authorizations: string[] = [];
  const options = {
    url: 'http://127.0.0.1:55439', anonKey: 'local-public-anon-key', accessToken: 'fixture-actor-a', retryReads: false,
    fetch: (async (_input, init) => {
      authorizations.push(new Headers(init?.headers).get('authorization')!);
      return new Response('[]', { status: 200, headers: { 'content-type': 'application/json' } });
    }) as typeof fetch,
  };
  const original = createKoraClient(options);
  options.accessToken = 'fixture-actor-b';
  const next = createKoraClient(options);
  await original.from('products').select('id');
  await next.from('products').select('id');
  await original.from('products').select('id');
  expect(authorizations).toEqual(['Bearer fixture-actor-a', 'Bearer fixture-actor-b', 'Bearer fixture-actor-a']);
});
