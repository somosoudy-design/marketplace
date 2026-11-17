import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { createWebGoogleSessionBoundary } from '../src/google-web-session';
import { createGoogleSessionBoundary } from '../src/google-session-boundary';
import type { GoogleAttempt } from '../src/google-auth';

function store(values = new Map<string, string>()) {
  return { values, getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); }, removeItem: (key: string) => { values.delete(key); } };
}
function lock() {
  let tail = Promise.resolve();
  return <T>(work: () => Promise<T>): Promise<T> => {
    const result = tail.then(work); tail = result.then(() => undefined, () => undefined); return result;
  };
}
function native(storage: ReturnType<typeof store>) {
  let stamp: string | null = null;
  return createGoogleSessionBoundary(storage, 'session', { read: () => stamp, write: value => { stamp = value; } }, randomUUID, undefined, { durable: true });
}
describe('integrated admission storage boundaries', () => {
  it('two web realms/aliases share consumed nonce and only one can claim a copied attempt', async () => {
    const underlying = store(), shared = lock();
    const a = createWebGoogleSessionBoundary(underlying, 'session', shared, randomUUID);
    const b = createWebGoogleSessionBoundary(store(underlying.values), 'session', shared, randomUUID);
    a.invalidate(); const ticket = await a.capture();
    const attempt = { id: 'copied-nonce', expiresAt: Date.now() + 60_000, ticket } as GoogleAttempt;
    const results = await Promise.all([a.claimAttempt(attempt), b.claimAttempt(attempt)]);
    expect(results.filter(Boolean)).toHaveLength(1);
    expect(underlying.getItem('session')).toBeNull();
    expect(underlying.getItem('session.google-claims.v1')).not.toContain('verifier');
  });
  it('web reload uses the shared stamp and cannot overwrite a later unrelated primary session', async () => {
    const underlying = store(), shared = lock();
    const a = createWebGoogleSessionBoundary(underlying, 'session', shared, randomUUID);
    a.invalidate(); const ticket = await a.capture();
    const reload = createWebGoogleSessionBoundary(store(underlying.values), 'session', shared, randomUUID);
    expect(reload.isCurrent(ticket)).toBe(true);
    await reload.storage.setItem('session', 'session-b');
    expect(await a.commit(ticket, 'candidate-a', () => true)).toBe(false);
    expect(await reload.storage.getItem('session')).toBe('session-b');
  });
  it('an old conditional cancellation rechecks its stamp inside the shared lock', async () => {
    const underlying = store(), shared = lock();
    let delay = false, release!: () => void;
    const wait = new Promise<void>(resolve => { release = resolve; });
    const a = createWebGoogleSessionBoundary(underlying, 'session', async work => { if (delay) await wait; return shared(work); }, randomUUID);
    const b = createWebGoogleSessionBoundary(store(underlying.values), 'session', shared, randomUUID);
    a.invalidate(); const old = await a.capture();
    delay = true; a.invalidate(old);
    b.invalidate(); const newer = await b.capture();
    delay = false; release(); await a.storage.getItem('session');
    expect(b.isCurrent(newer)).toBe(true);
    expect(a.isCurrent(old)).toBe(false);
  });
  it('web commit is final before observer cancellation and never rolls it back', async () => {
    const underlying = store();
    const boundary = createWebGoogleSessionBoundary(underlying, 'session', lock(), randomUUID);
    boundary.invalidate(); const ticket = await boundary.capture();
    boundary.subscribe(boundary.invalidate);
    expect(await boundary.commit(ticket, 'accepted-a', () => true)).toBe(true);
    expect(await boundary.storage.getItem('session')).toBe('accepted-a');
    expect(boundary.isCurrent(ticket)).toBe(false);
  });
  it.each([false, true])('native restart repairs the durable journal and preserves unrelated B=%s', async unrelated => {
    const underlying = store();
    underlying.setItem('session.google-promotion.v1', JSON.stringify({ version: 1, candidate: 'candidate-a' }));
    underlying.setItem('session', unrelated ? 'session-b' : 'candidate-a');
    const restarted = native(underlying);
    expect(await restarted.storage.getItem('session')).toBe(unrelated ? 'session-b' : null);
    expect(underlying.getItem('session.google-promotion.v1')).toBeNull();
  });
  it('native lost acknowledgement after final clear reports uncertainty and reconciles without deleting an unrelated session', async () => {
    const backing = store(); let cleared = false, failRead = false;
    const adapter = { ...backing,
      getItem: (key: string) => { if (failRead && key.endsWith('.google-promotion.v1')) { failRead = false; throw Error('Temporary read failure'); } return backing.getItem(key); },
      removeItem: (key: string) => {
        backing.removeItem(key);
        if (key.endsWith('.google-promotion.v1') && !cleared) { cleared = true; failRead = true; throw Error('Lost acknowledgement'); }
      },
    };
    const boundary = native(adapter); boundary.invalidate(); const ticket = await boundary.capture();
    await expect(boundary.commit(ticket, 'accepted-at-final-clear', () => true)).rejects.toMatchObject({ code: 'commit_uncertain' });
    expect(await boundary.storage.getItem('session')).toBe('accepted-at-final-clear');
    // The final acceptance operation began before its acknowledgement was lost. Do not report cancelled or retry a grant.
    const restarted = native(store(backing.values));
    expect(await restarted.storage.getItem('session')).toBe('accepted-at-final-clear');
    backing.setItem('session', 'session-b');
    expect(await restarted.storage.getItem('session')).toBe('session-b');
  });
  it('native malformed journal blocks SDK reads and preserves all evidence and B', async () => {
    const underlying = store(); underlying.setItem('session.google-promotion.v1', 'invalid'); underlying.setItem('session', 'session-b');
    await expect(native(underlying).storage.getItem('session')).rejects.toMatchObject({ code: 'rollback_pending' });
    expect(underlying.getItem('session')).toBe('session-b');
    expect(underlying.getItem('session.google-promotion.v1')).toBe('invalid');
  });
});
