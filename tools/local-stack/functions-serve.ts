// Local stand-in for the Supabase edge runtime: serves supabase/functions/<name>/handler.ts at
// http://127.0.0.1:54331/<name>, which the gateway exposes as /functions/v1/<name>.
// On a workstation with Docker, `supabase functions serve` does the same with the real runtime.
const root = new URL('../../supabase/functions/', import.meta.url);
const port = Number(Deno.env.get('FUNCTIONS_PORT') ?? 54331);
const names = [...Deno.readDirSync(root)].filter((e) => e.isDirectory && !e.name.startsWith('_') && e.name !== 'tests').map((e) => e.name);
const handlers = new Map<string, (req: Request) => Promise<Response>>();
for (const name of names) {
  const mod = await import(new URL(`${name}/handler.ts`, root).href);
  handlers.set(name, mod.createHandler());
}
Deno.serve({ hostname: '127.0.0.1', port, onListen: () => console.log(`· functions on :${port}: ${names.join(', ')}`) }, (req) => {
  const name = new URL(req.url).pathname.split('/').filter(Boolean)[0] ?? '';
  const h = handlers.get(name);
  return h ? h(req) : Promise.resolve(Response.json({ error: 'not_found', message: `function ${name} not found` }, { status: 404 }));
});
