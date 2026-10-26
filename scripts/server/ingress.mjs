import { createServer } from 'node:http';
import { Readable } from 'node:stream';
import { posix } from 'node:path';

function admittedPath(path) {
  let decoded = path;
  try {
    for (let i = 0; i < 8; i++) {
      const next = decodeURIComponent(decoded);
      if (next === decoded) break;
      decoded = next;
      if (i === 7) return false;
    }
  } catch { return false; }
  decoded = posix.normalize(decoded.replaceAll('\\', '/')).toLowerCase();
  return !/^\/(?:cdn-cgi|__dev|exports)(?:\/|$)/.test(decoded)
    && !/^\/auth\/(?:dev(?:\/|$)|bootstrap(?:\/|$)|owner-claim(?:\/|$))/.test(decoded);
}

export async function listenIngress({ origin, port, dispatch }) {
  const server = createServer(async (req, res) => {
    try {
      if (req.headers.host?.toLowerCase() !== origin.host.toLowerCase()) {
        req.resume(); res.writeHead(421); res.end('This server answers only its configured hostname.'); return;
      }
      if (!req.url?.startsWith('/') || req.url.startsWith('//')) {
        req.resume(); res.writeHead(400); res.end(); return;
      }
      const url = new URL(req.url, origin);
      if (url.origin !== origin.origin || !admittedPath(url.pathname)) {
        req.resume(); res.writeHead(404); res.end(); return;
      }
      const headers = new Headers();
      for (const [name, value] of Object.entries(req.headers)) {
        if (value !== undefined && !/^(?:host|connection|transfer-encoding|forwarded|x-forwarded-.*|cf-.*|x-chest-server-url|x-rer-.*)$/.test(name)) {
          if (Array.isArray(value)) for (const item of value) headers.append(name, item);
          else headers.set(name, value);
        }
      }
      headers.set('host', origin.host);
      const controller = new AbortController();
      res.once('close', () => controller.abort());
      const response = await dispatch(new Request(url, { method: req.method, headers,
        signal: controller.signal,
        ...(!['GET', 'HEAD'].includes(req.method) ? { body: Readable.toWeb(req), duplex: 'half' } : {}),
      }));
      res.statusCode = response.status;
      for (const [name, value] of response.headers) if (!['set-cookie', 'transfer-encoding', 'connection'].includes(name)) res.setHeader(name, value);
      const cookies = response.headers.getSetCookie();
      if (cookies.length) res.setHeader('set-cookie', cookies);
      if (!response.body || req.method === 'HEAD') { await response.body?.cancel(); res.end(); return; }
      const stream = Readable.fromWeb(response.body);
      res.once('close', () => stream.destroy());
      stream.once('error', () => res.destroy());
      stream.pipe(res);
    } catch {
      if (!res.headersSent) res.writeHead(500, { 'content-type': 'text/plain' });
      res.end('Server request failed.');
    }
  });
  server.on('upgrade', (_req, socket) => socket.end('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n'));
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', resolve);
  });
  return { server, close: () => new Promise((resolve, reject) => {
    server.close(error => error ? reject(error) : resolve());
    server.closeAllConnections();
  }) };
}
