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

/** Update only the actor captured at submit; never let the shared Auth client pick a later account. */
export async function updateActorPassword(actorId: string, password: string, stillCurrent: () => boolean): Promise<void> {
  if (!stillCurrent()) throw new ActorChangedError();
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  if (!data.session?.access_token || data.session.user.id !== actorId || !stillCurrent()) throw new ActorChangedError();
  const token = data.session.access_token;
  await assertCurrentActor(actorId);
  if (!stillCurrent()) throw new ActorChangedError();
  const response = await fetch(env.supabaseUrl.replace(/\/$/, '') + '/auth/v1/user', {
    method: 'PUT', credentials: 'omit',
    headers: { apikey: env.supabaseAnonKey, authorization: 'Bearer ' + token, 'content-type': 'application/json' },
    body: JSON.stringify({ password }),
  });
  const result = await response.json().catch(() => null) as { id?: string; user?: { id?: string } } | null;
  if (!response.ok) throw Object.assign(new Error('No pudimos actualizar tu contraseña. Verifica tu acceso e inténtalo de nuevo.'), { code: response.status === 401 ? 'session_not_found' : 'password_update_failed' });
  if ((result?.user?.id ?? result?.id) !== actorId) throw new ActorChangedError();
  await assertCurrentActor(actorId);
  if (!stillCurrent()) throw new ActorChangedError();
}
