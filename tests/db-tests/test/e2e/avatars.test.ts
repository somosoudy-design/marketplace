// Profile photos through the storage API the app uses (@kora/api): each user reads, uploads and deletes only in their
// own folder of the private avatars bucket, a profile can only point inside its own folder, and the bucket refuses
// other types and big files. Requires the local stack: `pnpm stack:start`.
import { createClient } from '@supabase/supabase-js';
import { ApiError, createApi, createKoraClient, type Api } from '@kora/api';
import { beforeAll, describe, expect, it } from 'vitest';
import '../../src/db'; // loads .local/keys.env into process.env

const URL = process.env.SUPABASE_URL ?? 'http://127.0.0.1:54321';
const ANON = process.env.SUPABASE_ANON_KEY!;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const PNG = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='), (c) => c.charCodeAt(0));

/** A confirmed test account, signed in on its own client like the app. */
async function signedIn(label: string): Promise<{ api: Api; id: string }> {
  const service = createClient(URL, SERVICE, { auth: { persistSession: false } });
  const email = `avatar-${label}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}@example.com`;
  const { data, error } = await service.auth.admin.createUser({ email, password: 'E2e-test-1234', email_confirm: true });
  if (error) throw error;
  const api = createApi(createKoraClient({ url: URL, anonKey: ANON }));
  const session = await api.client.auth.signInWithPassword({ email, password: 'E2e-test-1234' });
  if (session.error) throw session.error;
  return { api, id: data.user.id };
}

describe('profile photos', () => {
  let a: { api: Api; id: string };
  let b: { api: Api; id: string };
  beforeAll(async () => {
    a = await signedIn('a');
    b = await signedIn('b');
  });

  it('the owner uploads, sees and replaces its photo, and the old file goes', async () => {
    const first = await a.api.account.uploadAvatar(a.id, PNG, 'image/png', 'png');
    expect(first.startsWith(`${a.id}/`)).toBe(true);
    expect((await a.api.account.setAvatar(a.id, first)).avatar_path).toBe(first);
    expect((await fetch(await a.api.account.avatarUrl(first))).status).toBe(200);

    const second = await a.api.account.uploadAvatar(a.id, PNG, 'image/png', 'png');
    expect((await a.api.account.setAvatar(a.id, second, first)).avatar_path).toBe(second);
    await expect(a.api.account.avatarUrl(first)).rejects.toBeInstanceOf(ApiError);
  });

  it("nobody else can read, replace or delete it, or point their profile at it", async () => {
    const path = (await a.api.account.profile(a.id))!.avatar_path!;
    await expect(b.api.account.avatarUrl(path)).rejects.toBeInstanceOf(ApiError);
    await expect(b.api.account.uploadAvatar(a.id, PNG, 'image/png', 'png')).rejects.toBeInstanceOf(ApiError);
    await b.api.account.discardAvatar(path); // storage removes nothing that isn't yours
    expect((await fetch(await a.api.account.avatarUrl(path))).status).toBe(200);
    await expect(b.api.account.setAvatar(b.id, path)).rejects.toBeInstanceOf(ApiError);
    // nor someone signed out
    const visitor = createKoraClient({ url: URL, anonKey: ANON });
    expect((await visitor.storage.from('avatars').createSignedUrl(path, 60)).error).toBeTruthy();
    expect((await visitor.storage.from('avatars').download(path)).error).toBeTruthy();
  });

  it('the bucket refuses other file types and files over 3 MB', async () => {
    await expect(a.api.account.uploadAvatar(a.id, new TextEncoder().encode('hola'), 'text/plain', 'txt')).rejects.toBeInstanceOf(ApiError);
    await expect(a.api.account.uploadAvatar(a.id, new Uint8Array(3 * 1024 * 1024 + 1), 'image/jpeg', 'jpg')).rejects.toBeInstanceOf(ApiError);
  });

  it('removing the photo goes back to the initials and deletes the file', async () => {
    const path = (await a.api.account.profile(a.id))!.avatar_path!;
    expect((await a.api.account.setAvatar(a.id, null, path)).avatar_path).toBeNull();
    await expect(a.api.account.avatarUrl(path)).rejects.toBeInstanceOf(ApiError);
  });
});
