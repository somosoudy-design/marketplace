/** Native push lifecycle isolated from UI. The caller connects only after the current account is ready. */
export interface PushResponse {
  actionIdentifier: string;
  notification: { request: { identifier: string; content: { data?: unknown } } };
}
interface Subscription { remove(): void }
interface Source {
  defaultAction: string;
  lastResponse(): Promise<PushResponse | null>;
  clearResponse(): Promise<void>;
  onResponse(listener: (response: PushResponse) => void): Subscription;
  onReceived(listener: () => void): Subscription;
}
export function connectPushEvents(source: Source, refresh: () => void, open: (data: Record<string, unknown>) => void) {
  let active = true;
  const handled = new Set<string>();
  const receive = () => { if (active) refresh(); };
  const respond = (response: PushResponse | null) => {
    if (!active || !response || response.actionIdentifier !== source.defaultAction) return;
    const id = response.notification.request.identifier;
    if (handled.has(id)) return; // SDK's initial response and tap listener can report the same tap.
    handled.add(id);
    const data = response.notification.request.content.data;
    refresh();
    if (data && typeof data === 'object' && !Array.isArray(data)) open(data as Record<string, unknown>);
    source.clearResponse().catch(() => undefined);
  };
  const received = source.onReceived(receive);
  const response = source.onResponse(respond);
  source.lastResponse().then(respond).catch(() => undefined);
  return () => {
    active = false;
    received.remove();
    response.remove();
  };
}
