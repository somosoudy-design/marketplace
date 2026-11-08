import { describe, expect, it, vi } from 'vitest';
import { connectPushEvents, type PushResponse } from '../../apps/mobile/src/lib/push-events';
const response = (id = 'tap-1', actionIdentifier = 'open'): PushResponse => ({
  actionIdentifier, notification: { request: { identifier: id, content: { data: { kind: 'order_placed', order_id: 'order-1' } } } },
});
const tick = () => new Promise<void>(resolve => setTimeout(resolve, 0));
function fixture(last = Promise.resolve<PushResponse | null>(null)) {
  let onResponse: (response: PushResponse) => void = () => {};
  let onReceived: () => void = () => {};
  const unsubResponse = vi.fn(), unsubReceived = vi.fn();
  const source = {
    defaultAction: 'open', lastResponse: () => last, clearResponse: vi.fn().mockResolvedValue(undefined),
    onResponse: (cb: (response: PushResponse) => void) => { onResponse = cb; return { remove: unsubResponse }; },
    onReceived: (cb: () => void) => { onReceived = cb; return { remove: unsubReceived }; },
  };
  const refresh = vi.fn(), open = vi.fn();
  return { source, refresh, open, start: () => connectPushEvents(source, refresh, open),
    response: (r: PushResponse) => onResponse(r), receive: () => onReceived(), unsubResponse, unsubReceived };
}
describe('native push connection lifecycle', () => {
  it('opens the last explicit tap and refreshes server state without marking a payment', async () => {
    const f = fixture(Promise.resolve(response())); const stop = f.start(); await tick();
    expect(f.refresh).toHaveBeenCalledTimes(1); expect(f.open).toHaveBeenCalledWith({ kind: 'order_placed', order_id: 'order-1' });
    expect(f.source.clearResponse).toHaveBeenCalledTimes(1); stop();
  });
  it('coalesces the same tap delivered by the initial read and response listener', async () => {
    const f = fixture(Promise.resolve(response())); const stop = f.start(); f.response(response()); await tick();
    expect(f.open).toHaveBeenCalledTimes(1); expect(f.refresh).toHaveBeenCalledTimes(1); stop();
  });
  it('refreshes when a foreground push arrives, without navigating or consuming a tap', () => {
    const f = fixture(); const stop = f.start(); f.receive();
    expect(f.refresh).toHaveBeenCalledTimes(1); expect(f.open).not.toHaveBeenCalled(); expect(f.source.clearResponse).not.toHaveBeenCalled(); stop();
  });
  it('ignores a delayed response from a connection disposed on logout/account change', async () => {
    let resolve!: (r: PushResponse) => void;
    const f = fixture(new Promise<PushResponse>(r => { resolve = r; })); const stop = f.start(); stop(); resolve(response());
    f.receive(); f.response(response('other')); await tick();
    expect(f.open).not.toHaveBeenCalled(); expect(f.refresh).not.toHaveBeenCalled(); expect(f.source.clearResponse).not.toHaveBeenCalled();
    expect(f.unsubResponse).toHaveBeenCalledTimes(1); expect(f.unsubReceived).toHaveBeenCalledTimes(1);
  });
  it('ignores non-default actions instead of navigating unexpectedly', async () => {
    const f = fixture(Promise.resolve(response('dismiss', 'dismiss'))); const stop = f.start(); await tick();
    expect(f.open).not.toHaveBeenCalled(); expect(f.source.clearResponse).not.toHaveBeenCalled(); stop();
  });
  it('keeps foreground and response subscriptions usable if reading the last response fails', async () => {
    const f = fixture(Promise.reject(new Error('SDK unavailable'))); const stop = f.start(); await tick(); f.receive(); f.response(response());
    expect(f.refresh).toHaveBeenCalledTimes(2); expect(f.open).toHaveBeenCalledTimes(1); stop();
  });
});
