/** Reads configuration. Functions get SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY from the
 * platform; provider secrets are set with `supabase secrets set` and never reach the app. */
export type Env = (name: string) => string | undefined;
export const denoEnv: Env = (name) => Deno.env.get(name) || undefined;

export interface Deps {
  env: Env;
  /** fetch used for third parties (rate sources, payment providers, Expo). Injected in tests. */
  fetch: typeof fetch;
}
export const defaultDeps = (): Deps => ({ env: denoEnv, fetch: globalThis.fetch.bind(globalThis) });
