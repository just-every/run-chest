// The reference malware scanner for Chest (SECURITY-002, docs/threats.md): a small HTTP adapter that streams each
// original Chest posts to a ClamAV daemon (clamd INSTREAM) and answers with Chest's verdict JSON. Deploy it next to
// clamd behind HTTPS; Chest never runs a scanning engine itself.
//   SCANNER_TOKEN=<secret> CLAMD_SOCKET=/var/run/clamav/clamd.ctl node scripts/scanner/server.mjs
// or CLAMD_HOST/CLAMD_PORT for a TCP daemon; HOST/PORT choose the listening address (default 127.0.0.1:8080).
import http from 'node:http';
import net from 'node:net';
import { once } from 'node:events';
import { createHash, timingSafeEqual } from 'node:crypto';

function connect(target) { return target.socket ? net.createConnection(target.socket) : net.createConnection(target.port ?? 3310, target.host ?? '127.0.0.1'); }
// One z-mode command per connection: clamd answers once, NUL-terminated, and closes.
function reply(socket) {
  return new Promise((resolve, reject) => {
    let out = '';
    socket.on('data', d => { out += d; if (out.endsWith('\0')) { socket.destroy(); resolve(out.slice(0, -1).trim()); } });
    socket.on('end', () => resolve(out.replace(/\0$/, '').trim()));
    socket.on('error', reject);
    socket.setTimeout(120_000, () => socket.destroy(new Error('clamd timed out')));
  });
}
async function version(target) {
  const socket = connect(target), answer = reply(socket); socket.write('zVERSION\0');
  const [engine, definitions] = (await answer).split('/');
  return { engine: engine || 'ClamAV', definitions: definitions || '' };
}
async function instream(target, body) {
  const socket = connect(target), answer = reply(socket);
  socket.write('zINSTREAM\0');
  // clamd may answer early (for example over its stream size limit) and close; stop sending and report its answer.
  for await (const chunk of body) {
    for (let at = 0; at < chunk.length && !socket.destroyed; at += 65536) {
      const part = chunk.subarray(at, at + 65536), size = Buffer.alloc(4); size.writeUInt32BE(part.length);
      if (!socket.write(Buffer.concat([size, part]))) await Promise.race([once(socket, 'drain'), once(socket, 'close')]);
    }
  }
  if (!socket.destroyed) socket.write(Buffer.alloc(4));
  return answer;
}
export async function startScanner({ token, socket, host, port = 8080, listen = '127.0.0.1' }) {
  if (!token) throw new Error('SCANNER_TOKEN is required');
  const target = { socket, host, port: undefined }, wanted = Buffer.from(`Bearer ${token}`);
  if (!socket && host) target.port = Number(process.env.CLAMD_PORT || 3310);
  const server = http.createServer(async (req, res) => {
    const send = (status, body) => { res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' }); res.end(JSON.stringify(body)); };
    try {
      if (req.method === 'GET' && req.url === '/health') return send(200, { ok: true, ...await version(target) });
      if (req.method !== 'POST') return send(405, { error: 'method_not_allowed' });
      const given = Buffer.from(req.headers.authorization ?? '');
      if (given.length !== wanted.length || !timingSafeEqual(given, wanted)) { req.resume(); return send(401, { error: 'unauthorized' }); }
      const hash = createHash('sha256'), body = (async function* () { for await (const chunk of req) { hash.update(chunk); yield chunk; } })();
      const result = await instream(target, body), expected = req.headers['x-chest-sha256'];
      if (expected && hash.digest('hex') !== expected) return send(422, { error: 'checksum_mismatch' });
      const { engine, definitions } = await version(target), found = /^stream: (.+) FOUND$/.exec(result);
      if (found) return send(200, { verdict: 'infected', signature: found[1], engine, definitions });
      if (result === 'stream: OK') return send(200, { verdict: 'clean', engine, definitions });
      return send(502, { error: 'scanner_error', detail: result.slice(0, 200) });
    } catch (error) { send(502, { error: 'scanner_unreachable', detail: String(error?.message ?? error).slice(0, 200) }); }
  });
  server.listen(port, listen); await once(server, 'listening');
  return { server, port: server.address().port };
}
if (process.argv[1] === new URL(import.meta.url).pathname) {
  const { port } = await startScanner({ token: process.env.SCANNER_TOKEN, socket: process.env.CLAMD_SOCKET, host: process.env.CLAMD_HOST, port: Number(process.env.PORT || 8080), listen: process.env.HOST || '127.0.0.1' });
  console.log(`Chest scanner adapter listening on ${process.env.HOST || '127.0.0.1'}:${port}`);
}
