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
