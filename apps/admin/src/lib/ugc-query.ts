import { runUgcActor, type Api, type UgcPolicy, type UgcStatus } from '@kora/api';

type Owner = { actor: string | null | undefined; revision: number };
/** Shared queries belong to the auth epoch, not to the observer that started them. */
export function readUgcState(actor: string | null, expected: Owner, snapshot: () => Owner,
  capture: (id: string) => Promise<{ api: Api; assertCurrent: () => Promise<void> }>): Promise<UgcStatus | UgcPolicy> {
  return runUgcActor(actor, () => snapshot() === expected && expected.actor === actor, capture, api => api.ugc.status());
}
