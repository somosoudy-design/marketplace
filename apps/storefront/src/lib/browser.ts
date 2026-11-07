'use client';
import { createKoraClient, createApi } from '@kora/api';
import { env } from './env';
let connection: { client: ReturnType<typeof createKoraClient>; api: ReturnType<typeof createApi> } | undefined;
export function browser() {
  if (typeof window === 'undefined') throw new Error('Browser client used outside the browser');
  if (!connection) {
    const client = createKoraClient({
      url: env.url,
      anonKey: env.anon,
      storage: window.localStorage,
      detectSessionInUrl: false,
      retryReads: false,
    });
    connection = { client, api: createApi(client) };
  }
  return connection;
}
