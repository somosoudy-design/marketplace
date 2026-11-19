// Read-only preparation for the owner's mayami.app zone. No credentials or DNS changes are persisted.
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const domain = 'mayami.app';
const apiOrigin = 'https://api.cloudflare.com/client/v4';
export async function inspectCloudflare({ token, fetchImpl = globalThis.fetch }) {
  if (!token) throw new Error('Falta CLOUDFLARE_API_TOKEN en el almacenamiento seguro del entorno.');
  const get = async (path) => {
    let response;
    try {
      response = await fetchImpl(`${apiOrigin}${path}`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
        redirect: 'error',
        signal: AbortSignal.timeout(30_000),
      });
    } catch {
      throw new Error('No se pudo consultar Cloudflare; comprobar acceso de red y credencial configurada.');
    }
    if (!response.ok) throw new Error(`Cloudflare respondió HTTP ${response.status}; no se modificó DNS.`);
    let body;
    try { body = await response.json(); } catch { throw new Error('Cloudflare devolvió una respuesta inválida.'); }
    if (!body.success || !Array.isArray(body.result)) throw new Error('Cloudflare no confirmó la consulta.');
    if ((body.result_info?.total_pages ?? 1) > 1) throw new Error('Respuesta paginada: inspección incompleta, no modificar DNS.');
    return body.result;
  };
  const zones = await get(`/zones?name=${domain}&per_page=50`);
  if (zones.length !== 1 || zones[0].name !== domain || !/^[a-f0-9]{32}$/.test(zones[0].id ?? ''))
    throw new Error('No hay una zona mayami.app inequívoca accesible; comprobar cuenta y alcance del token.');
  const zone = zones[0];
  const hosts = [domain, `www.${domain}`, `preview.${domain}`, `panel.${domain}`];
  const records = [];
  for (const host of hosts) {
    const found = await get(`/zones/${zone.id}/dns_records?name=${encodeURIComponent(host)}&per_page=100`);
    for (const record of found) {
      if (record.name !== host) throw new Error('Cloudflare devolvió registros ajenos al host solicitado.');
      if (['A', 'AAAA', 'CNAME'].includes(record.type)) records.push({
        id: record.id, name: record.name, type: record.type,
        content: record.content, proxied: record.proxied, ttl: record.ttl,
      });
    }
  }
  return {
    observedAt: new Date().toISOString(), domain, zoneId: zone.id, status: zone.status,
    accountId: zone.account?.id ?? null, nameservers: zone.name_servers ?? [], records,
    operations: 'GET only; no DNS, TLS, email or hosting changes',
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  inspectCloudflare({ token: process.env.CLOUDFLARE_API_TOKEN })
    .then(result => console.log(JSON.stringify(result, null, 2)))
    .catch(error => { console.error(error.message); process.exitCode = 1; });
}
