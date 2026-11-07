import { createApi, createKoraClient } from '@kora/api';
import { env } from './env';
import { supabase } from './supabase';

export class ActorChangedError extends Error {
  readonly code = 'actor_changed';
  constructor() { super('La cuenta cambió. Revisa tu sesión antes de continuar.'); this.name = 'ActorChangedError'; }
}
export async function assertCurrentActor(actorId: string) {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  if (data.session?.user.id !== actorId) throw new ActorChangedError();
}
/** A request-only client: no token is persisted and no shared Authorization header is mutated. */
export async function captureActorApi(actorId: string) {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  if (!data.session?.access_token || data.session.user.id !== actorId) throw new ActorChangedError();
  const token = data.session.access_token;
  const client = createKoraClient({
    url: env.supabaseUrl, anonKey: env.supabaseAnonKey, accessToken: token, retryReads: false,
  });
  return { actorId, api: createApi(client), assertCurrent: () => assertCurrentActor(actorId) };
}
