// Local stand-in for the project's email: an SMTP sink that Supabase Auth (GoTrue) sends to, plus a small HTTP
// side that serves the email templates in supabase/templates to GoTrue and lets tests read what was sent.
//   SMTP  127.0.0.1:2500  accepts every message, stores it in .local/mail/
//   HTTP  127.0.0.1:2501  GET /templates/<name>.html · GET /messages?to=<email> (newest first) · DELETE /messages
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import http from 'node:http';
import net from 'node:net';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const box = join(root, '.local/mail');
const templates = join(root, 'supabase/templates');
mkdirSync(box, { recursive: true });

function decodeBody(raw) {
  const [head = '', ...rest] = raw.split(/\r?\n\r?\n/);
  let body = rest.join('\n\n');
  if (/content-transfer-encoding:\s*quoted-printable/i.test(head)) {
    body = body.replace(/=\r?\n/g, '').replace(/=([0-9A-F]{2})/gi, (_, h) => String.fromCharCode(parseInt(h, 16)));
    body = Buffer.from(body, 'latin1').toString('utf8');
  } else if (/content-transfer-encoding:\s*base64/i.test(head)) {
    body = Buffer.from(body.replace(/\s+/g, ''), 'base64').toString('utf8');
  }
  return { head, body };
}

function parse(raw, to) {
  const { head, body } = decodeBody(raw);
  const subject = (head.match(/^subject:\s*(.*)$/im)?.[1] ?? '')
    .trim()
    // RFC 2047 encoded words, as GoTrue sends non-ASCII subjects
    .replace(/=\?utf-8\?([qb])\?([^?]*)\?=/gi, (_, enc, text) =>
      enc.toLowerCase() === 'b'
        ? Buffer.from(text, 'base64').toString('utf8')
        : Buffer.from(text.replace(/_/g, ' ').replace(/=([0-9A-F]{2})/gi, (_m, h) => String.fromCharCode(parseInt(h, 16))), 'latin1').toString('utf8'),
    );
  const text = body.replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
  // the code is the first run of 6 to 10 digits in the visible text
  const code = text.match(/\b(\d{6,10})\b/)?.[1] ?? null;
  const links = [...body.matchAll(/href="([^"]+)"/g)].map((m) => m[1].replace(/&amp;/g, '&'));
  return { to, subject, text, html: body, code, links, at: new Date().toISOString() };
}

net
  .createServer((socket) => {
    let rcpt = [];
    let data = null;
    const say = (line) => socket.write(`${line}\r\n`);
    say('220 kora-mail ready');
    let buffer = '';
    socket.on('data', (chunk) => {
      buffer += chunk.toString('latin1');
      while (true) {
        if (data !== null) {
          const end = buffer.indexOf('\r\n.\r\n');
          if (end < 0) return;
          data += buffer.slice(0, end);
          buffer = buffer.slice(end + 5);
          const raw = Buffer.from(data.replace(/\r\n\.\./g, '\r\n.'), 'latin1').toString('latin1');
          for (const to of rcpt) {
            const msg = parse(raw, to);
            writeFileSync(join(box, `${Date.now()}-${Math.random().toString(36).slice(2, 7)}.json`), JSON.stringify(msg));
          }
          data = null;
          rcpt = [];
          say('250 OK queued');
          continue;
        }
        const nl = buffer.indexOf('\r\n');
        if (nl < 0) return;
        const line = buffer.slice(0, nl);
        buffer = buffer.slice(nl + 2);
        const cmd = line.slice(0, 4).toUpperCase();
        if (cmd === 'EHLO' || cmd === 'HELO') say('250 kora-mail');
        else if (cmd === 'MAIL') say('250 OK');
        else if (cmd === 'RCPT') {
          rcpt.push((line.match(/<([^>]+)>/)?.[1] ?? '').toLowerCase());
          say('250 OK');
        } else if (cmd === 'DATA') {
          data = '';
          say('354 end with <CRLF>.<CRLF>');
        } else if (cmd === 'QUIT') {
          say('221 bye');
          socket.end();
          return;
        } else if (cmd === 'RSET') {
          rcpt = [];
          say('250 OK');
        } else say('250 OK');
      }
    });
    socket.on('error', () => undefined);
  })
  .listen(2500, '127.0.0.1');

function messages(to) {
  return readdirSync(box)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .reverse()
    .map((f) => JSON.parse(readFileSync(join(box, f), 'utf8')))
    .filter((m) => !to || m.to === to.toLowerCase());
}

http
  .createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1');
    const send = (status, body, type = 'application/json') => {
      res.writeHead(status, { 'content-type': type });
      res.end(typeof body === 'string' ? body : JSON.stringify(body));
    };
    const tpl = url.pathname.match(/^\/templates\/([a-z_]+\.html)$/);
    if (tpl) {
      try {
        return send(200, readFileSync(join(templates, tpl[1]), 'utf8'), 'text/html; charset=utf-8');
      } catch {
        return send(404, { error: 'not_found' });
      }
    }
    if (url.pathname === '/messages' && req.method === 'GET') return send(200, messages(url.searchParams.get('to')));
    if (url.pathname === '/messages' && req.method === 'DELETE') {
      rmSync(box, { recursive: true, force: true });
      mkdirSync(box, { recursive: true });
      return send(200, { ok: true });
    }
    send(404, { error: 'not_found' });
  })
  .listen(2501, '127.0.0.1', () => console.log('mail sink: smtp 2500, http 2501'));
