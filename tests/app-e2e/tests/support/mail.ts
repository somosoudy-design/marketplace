// Reads what Supabase Auth emailed on the local stack (tools/local-stack/mail.mjs keeps every message).
const MAIL = process.env.KORA_MAIL_URL ?? 'http://127.0.0.1:2501';

export interface SentMail { to: string; subject: string; text: string; code: string | null; at: string }

/** Messages sent to this address, newest first. */
export async function inbox(email: string): Promise<SentMail[]> {
  const res = await fetch(`${MAIL}/messages?to=${encodeURIComponent(email)}`);
  if (!res.ok) throw new Error(`mail sink ${res.status}: is the local stack running?`);
  return (await res.json()) as SentMail[];
}

/** The code in the newest email to this address sent after `since`, waiting for it to arrive. */
export async function emailCode(email: string, since = 0, timeoutMs = 15_000): Promise<string> {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    const m = (await inbox(email)).find((x) => x.code && Date.parse(x.at) >= since);
    if (m?.code) return m.code;
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`no code emailed to ${email}`);
}
