export const cors = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type, idempotency-key',
  'access-control-allow-methods': 'POST, OPTIONS',
};

export function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', ...cors, ...headers } });
}

/** Plain-language error for the buyer or operator plus a stable code for the app. */
export const fail = (status: number, code: string, message: string) => json({ error: code, message }, status);

export function bearer(req: Request): string | null {
  const h = req.headers.get('authorization') ?? '';
  const m = /^Bearer\s+(.+)$/i.exec(h);
  return m ? m[1]!.trim() : null;
}

export async function readJson<T>(req: Request): Promise<T | null> {
  try {
    return (await req.json()) as T;
  } catch {
    return null;
  }
}
