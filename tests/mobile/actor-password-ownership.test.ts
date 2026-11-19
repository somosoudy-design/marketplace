import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const session = vi.hoisted(() => ({ actor: 'A', reads: 0, switchAfterRead: 0 }));
const getSession = vi.hoisted(() => vi.fn(async () => {
  const actor = session.actor;
  session.reads++;
  if (session.switchAfterRead === session.reads) session.actor = 'B';
  return { data: { session: { user: { id: actor }, access_token: `test-token-${actor}` } }, error: null };
}));
vi.mock('../../apps/storefront/src/lib/browser', () => ({ browser: () => ({ client: { auth: { getSession } } }) }));
vi.mock('../../apps/storefront/src/lib/env', () => ({ env: { url: 'http://127.0.0.1:55444', anon: 'test-public-key' } }));
vi.mock('../../apps/mobile/src/lib/supabase', () => ({ supabase: { auth: { getSession } } }));
vi.mock('../../apps/mobile/src/lib/env', () => ({ env: { supabaseUrl: 'http://127.0.0.1:55444', supabaseAnonKey: 'test-public-key' } }));

import { updateBuyerPassword } from '../../apps/storefront/src/lib/actor-api';
import { updateActorPassword } from '../../apps/mobile/src/lib/actor-api';

for (const [surface, update] of [['web', updateBuyerPassword], ['app', updateActorPassword]] as const) {
  describe(`${surface} password request ownership`, () => {
    beforeEach(() => {
      session.actor = 'A'; session.reads = 0; session.switchAfterRead = 0;
      getSession.mockClear();
    });
    afterEach(() => vi.unstubAllGlobals());

    it('does not transmit a password after cancellation or an account change before submission', async () => {
      const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
      await expect(update('A', 'Local-Password-2026', () => false)).rejects.toMatchObject({ code: 'actor_changed' });
      session.actor = 'B';
      await expect(update('A', 'Local-Password-2026', () => true)).rejects.toMatchObject({ code: 'actor_changed' });
      expect(fetcher).not.toHaveBeenCalled();
    });

    it('checks identity again when the session changes during capture', async () => {
      const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
      session.switchAfterRead = 1;
      await expect(update('A', 'Local-Password-2026', () => true)).rejects.toMatchObject({ code: 'actor_changed' });
      expect(fetcher).not.toHaveBeenCalled();
    });

    it('keeps an in-flight request bound to A and never reports success to B', async () => {
      let finish!: (response: Response) => void;
      const fetcher = vi.fn(() => new Promise<Response>(resolve => { finish = resolve; }));
      vi.stubGlobal('fetch', fetcher);
      const pending = update('A', 'Local-Password-2026', () => true);
      await vi.waitFor(() => expect(fetcher).toHaveBeenCalledOnce());
      const [url, options] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
      expect(url).toBe('http://127.0.0.1:55444/auth/v1/user');
      expect(options.method).toBe('PUT');
      expect(options.credentials).toBe('omit');
      expect(new Headers(options.headers).get('authorization')).toBe('Bearer test-token-A');
      session.actor = 'B';
      finish(new Response(JSON.stringify({ id: 'A' }), { status: 200 }));
      await expect(pending).rejects.toMatchObject({ code: 'actor_changed' });
      expect(fetcher).toHaveBeenCalledOnce();
    });

    it('rejects a late successful response after the owning form was cancelled', async () => {
      let alive = true, finish!: (response: Response) => void;
      const fetcher = vi.fn(() => new Promise<Response>(resolve => { finish = resolve; }));
      vi.stubGlobal('fetch', fetcher);
      const pending = update('A', 'Local-Password-2026', () => alive);
      await vi.waitFor(() => expect(fetcher).toHaveBeenCalledOnce());
      alive = false;
      finish(new Response(JSON.stringify({ id: 'A' }), { status: 200 }));
      await expect(pending).rejects.toMatchObject({ code: 'actor_changed' });
    });

    it.each([{ id: 'A' }, { user: { id: 'A' } }])('accepts only a confirmed response for the same current actor', async body => {
      vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(body), { status: 200 })));
      await expect(update('A', 'Local-Password-2026', () => true)).resolves.toBeUndefined();
    });

    it('does not treat a failed or mismatched server reply as success', async () => {
      const fetcher = vi.fn(async () => new Response('{}', { status: 401 })); vi.stubGlobal('fetch', fetcher);
      await expect(update('A', 'Local-Password-2026', () => true)).rejects.toBeInstanceOf(Error);
      fetcher.mockImplementation(async () => new Response(JSON.stringify({ id: 'B' }), { status: 200 }));
      await expect(update('A', 'Local-Password-2026', () => true)).rejects.toMatchObject({ code: 'actor_changed' });
    });
  });
}
