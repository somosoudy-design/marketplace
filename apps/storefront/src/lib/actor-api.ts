'use client';
import { createApi, createKoraClient } from '@kora/api';
import { browser } from './browser';
import { env } from './env';

export class BuyerChangedError extends Error {
  readonly code = 'actor_changed';
  constructor() { super('La cuenta cambió. Revisa tu sesión antes de continuar.'); this.name = 'BuyerChangedError'; }
}
export async function assertBuyerActor(buyerId: string) {
  const { data, error } = await browser().client.auth.getSession();
  if (error) throw error;
  if (data.session?.user.id !== buyerId) throw new BuyerChangedError();
}
export async function captureBuyerApi(buyerId: string) {
  const { data, error } = await browser().client.auth.getSession();
  if (error) throw error;
  if (!data.session?.access_token || data.session.user.id !== buyerId) throw new BuyerChangedError();
  const client = createKoraClient({ url: env.url, anonKey: env.anon, accessToken: data.session.access_token, retryReads: false });
  return { api: createApi(client), assertCurrent: () => assertBuyerActor(buyerId) };
}

/** The password request uses one captured actor token, without changing the browser SDK's session. */
export async function updateBuyerPassword(buyerId: string, password: string, stillCurrent: () => boolean) {
  if (!stillCurrent()) throw new BuyerChangedError();
  const { data, error } = await browser().client.auth.getSession();
  if (error) throw error;
  if (!data.session?.access_token || data.session.user.id !== buyerId || !stillCurrent()) throw new BuyerChangedError();
  const token = data.session.access_token;
  await assertBuyerActor(buyerId);
  if (!stillCurrent()) throw new BuyerChangedError();
  // Same Auth endpoint used by the installed GoTrueClient._updateUser. Never read a later actor's token.
  const response = await fetch(env.url.replace(/\/$/, '') + '/auth/v1/user', {
    method: 'PUT', credentials: 'omit', headers: { apikey: env.anon, authorization: 'Bearer ' + token, 'content-type': 'application/json' },
    body: JSON.stringify({ password }),
  });
  const result = await response.json().catch(() => null) as { id?: string; user?: { id?: string } } | null;
  if (!response.ok) throw Object.assign(new Error('No pudimos actualizar la contraseña. Verifica de nuevo tu acceso e inténtalo de nuevo.'), { name: 'ValidationError' });
  if ((result?.user?.id ?? result?.id) !== buyerId) throw new BuyerChangedError();
  await assertBuyerActor(buyerId);
  if (!stillCurrent()) throw new BuyerChangedError();
}
