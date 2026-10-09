import * as Linking from 'expo-linking';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { supabase } from './supabase';

/**
 * Links from Supabase Auth emails (confirm sign-up, reset password) come back to the app as
 * `kora://<route>#access_token=…&refresh_token=…&type=…`, as `?code=…` (PKCE), or with `error_code` when the
 * link expired or was already used. The redirect only reaches the app when `kora://**` is in the project's
 * allowed redirect URLs (docs/INSTALACION.md).
 */
export interface AuthLinkParams {
  code?: string;
  access_token?: string;
  refresh_token?: string;
  type?: string;
  error?: string;
  error_code?: string;
  error_description?: string;
}

export function parseAuthLink(url: string | null | undefined): AuthLinkParams {
  if (!url) return {};
  const out: Record<string, string> = {};
  const [beforeHash, hash = ''] = url.split('#');
  const query = beforeHash!.includes('?') ? beforeHash!.slice(beforeHash!.indexOf('?') + 1) : '';
  for (const part of [query, hash]) {
    for (const [k, v] of new URLSearchParams(part)) out[k] = v;
  }
  return out;
}

/** Where an email link should send the user back to: `kora://<path>` in the app, the same origin on the web. */
export const authRedirect = (path: string) => Linking.createURL(path);

export type AuthLinkState =
  | { status: 'working' }
  | { status: 'ready'; type: string | null }
  | { status: 'invalid'; reason: 'expired' | 'missing' | 'failed' };

// On the web supabase-js reads (and clears) the URL fragment as soon as it starts, so keep the address the
// page was opened with to tell an expired link apart from a page opened by hand.
const webInitialUrl = Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.href : null;

function linkError(p: AuthLinkParams): AuthLinkState | null {
  if (!p.error && !p.error_code) return null;
  return { status: 'invalid', reason: p.error_code === 'otp_expired' || /expired|invalid/i.test(p.error_description ?? '') ? 'expired' : 'failed' };
}

/** Turns the link the app was opened with into a session. Opening the screen without a link keeps a current session. */
export function useAuthLinkSession(): AuthLinkState {
  const nativeUrl = Linking.useURL();
  const [state, setState] = useState<AuthLinkState>({ status: 'working' });
  const url = Platform.OS === 'web' ? webInitialUrl : nativeUrl;

  useEffect(() => {
    let cancelled = false;
    const done = (s: AuthLinkState) => !cancelled && setState(s);
    const p = parseAuthLink(url);
    (async () => {
      const failed = linkError(p);
      if (failed) return done(failed);
      try {
        if (Platform.OS !== 'web') {
          if (p.code) {
            const { error } = await supabase.auth.exchangeCodeForSession(p.code);
            if (error) return done({ status: 'invalid', reason: 'expired' });
          } else if (p.access_token && p.refresh_token) {
            const { error } = await supabase.auth.setSession({ access_token: p.access_token, refresh_token: p.refresh_token });
            if (error) return done({ status: 'invalid', reason: 'expired' });
          }
        }
        // the web client has already stored the session from the link by the time getSession resolves
        const { data } = await supabase.auth.getSession();
        if (data.session) return done({ status: 'ready', type: p.type ?? null });
        done({ status: 'invalid', reason: 'missing' });
      } catch {
        done({ status: 'invalid', reason: 'failed' });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [url]);

  return state;
}
