import { describe, expect, it } from 'vitest';
import { createUgcOwnerStore, type Api } from '@kora/api';
import { readUgcState } from '../src/lib/ugc-query';

describe('shared UGC status query ownership', () => {
  function setup() {
    const owner = createUgcOwnerStore(); owner.update('buyer');
    let finish!: (value: { enabled: boolean }) => void;
    const result = new Promise<{ enabled: boolean }>(resolve => { finish = resolve; });
    const api = { ugc: { status: () => result } } as unknown as Api;
    const capture = async () => ({ api, assertCurrent: async () => {} });
    return { owner, finish, capture };
  }
  it('keeps a shared read valid when observers change but the actor does not', async () => {
    const { owner, finish, capture } = setup();
    const query = readUgcState('buyer', owner.snapshot(), owner.snapshot, capture);
    // An observer remount changes neither the store nor the auth epoch.
    owner.update('buyer'); finish({ enabled: true });
    await expect(query).resolves.toEqual({ enabled: true });
  });
  it('rejects an in-flight read after a real actor change', async () => {
    const { owner, finish, capture } = setup();
    const query = readUgcState('buyer', owner.snapshot(), owner.snapshot, capture);
    owner.update('seller'); finish({ enabled: true });
    await expect(query).rejects.toMatchObject({ code: 'actor_changed' });
  });
  it('rejects an old read even when the same actor returns', async () => {
    const { owner, finish, capture } = setup();
    const query = readUgcState('buyer', owner.snapshot(), owner.snapshot, capture);
    owner.update('seller'); owner.update('buyer'); finish({ enabled: true });
    await expect(query).rejects.toMatchObject({ code: 'actor_changed' });
  });
});
