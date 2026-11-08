import { describe, expect, it, vi } from 'vitest';
import { createGoogleSessionBoundary, type GoogleSessionStorage, type GoogleSessionLock } from '../src/google-session-boundary';

const key = 'mock-primary-auth-session';
const A = '{"user":{"id":"A"},"access_token":"mock-A"}';
const B = '{"user":{"id":"B"},"access_token":"mock-B"}';
function deferred<T = void>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function fixture() {
  const values = new Map<string, string>();
  let current: string | null = null, id = 0;
  const underlying: GoogleSessionStorage = {
    getItem: vi.fn(k => values.get(k) ?? null),
    setItem: vi.fn((k, value) => { values.set(k, value); }),
    removeItem: vi.fn(k => { values.delete(k); }),
  };
  const intent = { read: () => current, write: (value: string) => { current = value; } };
  const make = (lock?: GoogleSessionLock) => createGoogleSessionBoundary(underlying, key, intent, () => `intent-${++id}`, lock);
  return { values, underlying, intent, make };
}
async function tick() { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); }

describe('Google session storage boundary (mock storage only, no Auth/network)', () => {
  it('captures only a stable guest baseline, with an opaque stamp and synchronous invalidation', async () => {
    const f = fixture(), boundary = f.make();
    const ticket = await boundary.capture();
    expect(ticket.baseline).toBeNull(); expect(ticket.stamp).toMatch(/^intent-/); expect(boundary.isCurrent(ticket)).toBe(true);
    boundary.invalidate(); expect(boundary.isCurrent(ticket)).toBe(false);
    f.values.set(key, B);
    await expect(boundary.capture()).rejects.toMatchObject({ code: 'guest_required' });
    expect(f.values.get(key)).toBe(B);
  });

  it('passes secondary keys through without invalidation, serialization, or Google events', async () => {
    const f = fixture(); let lockCalls = 0;
    const lock: GoogleSessionLock = async <T>(work: () => Promise<T>) => { lockCalls++; return work(); };
    const boundary = f.make(lock), ticket = await boundary.capture(), initialLockCalls = lockCalls, signal = vi.fn(); boundary.subscribe(signal);
    await boundary.storage.setItem('mock-code-verifier', 'opaque-verifier');
    expect(await boundary.storage.getItem('mock-code-verifier')).toBe('opaque-verifier');
    await boundary.storage.removeItem('mock-code-verifier');
    expect(boundary.isCurrent(ticket)).toBe(true); expect(lockCalls).toBe(initialLockCalls); expect(signal).not.toHaveBeenCalled();
  });

  it('SDK writes/removes invalidate synchronously before queueing and emit no promotion event', async () => {
    const f = fixture(), boundary = f.make(), signal = vi.fn(); boundary.subscribe(signal);
    const ticket = await boundary.capture();
    const write = boundary.storage.setItem(key, B);
    expect(boundary.isCurrent(ticket)).toBe(false); expect(f.values.has(key)).toBe(false);
    await write;
    expect(await boundary.storage.getItem(key)).toBe(B);
    const stamp = f.intent.read(); const remove = boundary.storage.removeItem(key);
    expect(f.intent.read()).not.toBe(stamp); expect(f.values.get(key)).toBe(B);
    await remove; expect(await boundary.storage.getItem(key)).toBeNull(); expect(signal).not.toHaveBeenCalled();
  });

  it('confirms one CAS commit and signals with no payload only after the write is stable', async () => {
    const f = fixture(), boundary = f.make(), signal = vi.fn(), unsubscribed = vi.fn();
    boundary.subscribe(signal); const unsubscribe = boundary.subscribe(unsubscribed); unsubscribe();
    const ticket = await boundary.capture();
    expect(await boundary.commit(ticket, A, () => true)).toBe(true);
    expect(await boundary.storage.getItem(key)).toBe(A); expect(signal.mock.calls).toEqual([[]]); expect(unsubscribed).not.toHaveBeenCalled();
    expect(boundary.isCurrent(ticket)).toBe(true);
    expect(await boundary.commit(ticket, A, () => true)).toBe(false); expect(signal).toHaveBeenCalledTimes(1);
  });

  it('rejects a stale stamp or cancelled guard before writing', async () => {
    const f = fixture(), boundary = f.make(), ticket = await boundary.capture();
    expect(await boundary.commit(ticket, A, () => false)).toBe(false);
    boundary.invalidate(); expect(await boundary.commit(ticket, A, () => true)).toBe(false);
    expect(f.underlying.setItem).not.toHaveBeenCalled(); expect(f.values.has(key)).toBe(false);
  });

  it('rejects capture if a later SDK writer invalidates during the baseline read', async () => {
    const f = fixture(), entered = deferred(), release = deferred(); let first = true;
    f.underlying.getItem = vi.fn(async k => { if (k === key && first) { first = false; entered.resolve(); await release.promise; } return f.values.get(k) ?? null; });
    const boundary = f.make(), capture = boundary.capture(); await entered.promise;
    const b = boundary.storage.setItem(key, B); release.resolve();
    await expect(capture).rejects.toMatchObject({ code: 'boundary_changed' }); await b;
    expect(await boundary.storage.getItem(key)).toBe(B);
  });

  it('rolls back a deferred write that applies after cancellation, before a queued read can see it', async () => {
    const f = fixture(), entered = deferred(), apply = deferred(), applied = deferred(), acknowledge = deferred(); let active = true;
    f.underlying.setItem = vi.fn(async (k, value) => { entered.resolve(); await apply.promise; f.values.set(k, value); applied.resolve(); await acknowledge.promise; });
    const boundary = f.make(), ticket = await boundary.capture(), signal = vi.fn(); boundary.subscribe(signal);
    const commit = boundary.commit(ticket, A, () => active); await entered.promise;
    active = false; apply.resolve(); await applied.promise; expect(f.values.get(key)).toBe(A);
    let readFinished = false; const read = Promise.resolve(boundary.storage.getItem(key)).then(value => { readFinished = true; return value; });
    await tick(); expect(readFinished).toBe(false); acknowledge.resolve();
    expect(await commit).toBe(false); expect(await read).toBeNull(); expect(f.values.has(key)).toBe(false); expect(signal).not.toHaveBeenCalled();
  });

  it('checks the guard again after the final verification read, with no premature signal', async () => {
    const f = fixture(), verifyEntered = deferred(), verifyRelease = deferred(); let reads = 0, active = true;
    f.underlying.getItem = vi.fn(async k => { reads++; if (reads === 3) { verifyEntered.resolve(); await verifyRelease.promise; } return f.values.get(k) ?? null; });
    const boundary = f.make(), ticket = await boundary.capture(), signal = vi.fn(); boundary.subscribe(signal);
    const commit = boundary.commit(ticket, A, () => active); await verifyEntered.promise;
    expect(f.values.get(key)).toBe(A); expect(signal).not.toHaveBeenCalled(); active = false; verifyRelease.resolve();
    expect(await commit).toBe(false); expect(await boundary.storage.getItem(key)).toBeNull(); expect(signal).not.toHaveBeenCalled();
  });

  it('a queued B invalidates A immediately; rollback finishes before B and the reader', async () => {
    const f = fixture(), entered = deferred(), release = deferred(), order: string[] = [];
    f.underlying.setItem = vi.fn(async (k, value) => { if (value === A) { entered.resolve(); await release.promise; } f.values.set(k, value); order.push(value === A ? 'A' : 'B'); });
    f.underlying.removeItem = vi.fn(k => { f.values.delete(k); order.push('rollback-A'); });
    const boundary = f.make(), ticket = await boundary.capture(), signal = vi.fn(); boundary.subscribe(signal);
    const a = boundary.commit(ticket, A, () => true); await entered.promise;
    const b = boundary.storage.setItem(key, B); expect(boundary.isCurrent(ticket)).toBe(false);
    const read = boundary.storage.getItem(key); release.resolve();
    expect(await a).toBe(false); await b; expect(await read).toBe(B);
    expect(order).toEqual(['A', 'rollback-A', 'B']); expect(signal).not.toHaveBeenCalled();
  });

  it('a queued SDK logout invalidates A before its deferred write resolves', async () => {
    const f = fixture(), entered = deferred(), release = deferred();
    f.underlying.setItem = vi.fn(async (k, value) => { entered.resolve(); await release.promise; f.values.set(k, value); });
    const boundary = f.make(), ticket = await boundary.capture(), a = boundary.commit(ticket, A, () => true); await entered.promise;
    const logout = boundary.storage.removeItem(key); expect(boundary.isCurrent(ticket)).toBe(false); release.resolve();
    expect(await a).toBe(false); await logout; expect(await boundary.storage.getItem(key)).toBeNull();
  });

  it('conditional cleanup preserves another session found after an uncertain candidate write', async () => {
    const f = fixture();
    f.underlying.setItem = vi.fn((k, value) => { f.values.set(k, value); f.values.set(k, B); f.intent.write('foreign-B'); });
    const boundary = f.make(), ticket = await boundary.capture();
    expect(await boundary.commit(ticket, A, () => true)).toBe(false);
    expect(f.underlying.removeItem).not.toHaveBeenCalled(); expect(await boundary.storage.getItem(key)).toBe(B);
  });

  it('inspects and repairs a setItem that rejects after applying its candidate', async () => {
    const f = fixture(), failure = new Error('Mock write acknowledgement lost');
    f.underlying.setItem = vi.fn((k, value) => { f.values.set(k, value); throw failure; });
    const boundary = f.make(), ticket = await boundary.capture(), signal = vi.fn(); boundary.subscribe(signal);
    await expect(boundary.commit(ticket, A, () => true)).rejects.toBe(failure);
    expect(await boundary.storage.getItem(key)).toBeNull(); expect(signal).not.toHaveBeenCalled();
  });

  it('failed rollback quarantines A from reads/capture, while a later SDK B can recover the queue', async () => {
    const f = fixture(); let active = true;
    f.underlying.setItem = vi.fn((k, value) => { f.values.set(k, value); if (value === A) active = false; });
    f.underlying.removeItem = vi.fn(() => { throw new Error('Mock removal unavailable'); });
    const boundary = f.make(), ticket = await boundary.capture(), signal = vi.fn(); boundary.subscribe(signal);
    await expect(boundary.commit(ticket, A, () => active)).rejects.toMatchObject({ code: 'rollback_pending' });
    expect(f.underlying.removeItem).toHaveBeenCalledTimes(1);
    expect(f.values.get(key)).toBe(A);
    await expect(boundary.storage.getItem(key)).rejects.toMatchObject({ code: 'rollback_pending' });
    await expect(boundary.capture()).rejects.toMatchObject({ code: 'rollback_pending' });
    await boundary.storage.setItem(key, B); expect(await boundary.storage.getItem(key)).toBe(B); expect(signal).not.toHaveBeenCalled();
  });

  it('rejects a second owner over the same storage object and primary key', () => {
    const f = fixture(); f.make(); expect(() => f.make()).toThrow('already has');
  });

  it('uses the injected lock for every primary transaction of its one owner', async () => {
    const f = fixture(), entered = deferred(), release = deferred(); let tail = Promise.resolve(), activeLocks = 0, maxLocks = 0;
    const lock: GoogleSessionLock = <T>(work: () => Promise<T>) => {
      const result = tail.then(async () => { activeLocks++; maxLocks = Math.max(maxLocks, activeLocks); try { return await work(); } finally { activeLocks--; } });
      tail = result.then(() => undefined, () => undefined); return result;
    };
    f.underlying.getItem = vi.fn(k => { if (k === key) expect(activeLocks).toBe(1); return f.values.get(k) ?? null; });
    f.underlying.removeItem = vi.fn(k => { if (k === key) expect(activeLocks).toBe(1); f.values.delete(k); });
    f.underlying.setItem = vi.fn(async (k, value) => { if (k === key) expect(activeLocks).toBe(1); if (value === A) { entered.resolve(); await release.promise; } f.values.set(k, value); });
    const boundary = f.make(lock), ticket = await boundary.capture();
    const a = boundary.commit(ticket, A, () => true); await entered.promise;
    const b = boundary.storage.setItem(key, B); expect(boundary.isCurrent(ticket)).toBe(false);
    let readFinished = false; const read = Promise.resolve(boundary.storage.getItem(key)).then(value => { readFinished = true; return value; });
    await tick(); expect(readFinished).toBe(false); release.resolve();
    expect(await a).toBe(false); await b; expect(await read).toBe(B); expect(maxLocks).toBe(1);
  });
});
