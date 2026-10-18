// R2 objects through R2's S3-compatible endpoint, signed (AWS Signature V4) with the deploying API token: its ID is
// the access key and the SHA-256 of its value the secret, as Cloudflare documents for API tokens with R2 access.
// Cloudflare's REST object upload is capped well below Chest's 4 GB files, so large originals go up in parts.
import { createHash, createHmac } from 'node:crypto';
import { createWriteStream, openSync, readSync, closeSync, statSync } from 'node:fs';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { cloudflare } from './account.mjs';

const PART = 64 * 1024 * 1024;
const hex = data => createHash('sha256').update(data).digest('hex');
const hmac = (key, data) => createHmac('sha256', key).update(data).digest();
const encode = s => encodeURIComponent(s).replace(/[!'()*]/g, c => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);

export async function r2(creds, bucket) {
  const verified = await cloudflare(creds, '/tokens/verify').catch(() => null) ?? await fetch('https://api.cloudflare.com/client/v4/user/tokens/verify', { headers: { authorization: `Bearer ${creds.token}` } }).then(r => r.json());
  const keyId = verified?.result?.id;
  if (!keyId) throw new Error('Cloudflare did not confirm this API token, so its R2 access could not be used.');
  const secret = hex(creds.token), host = `${creds.account}.r2.cloudflarestorage.com`;
  async function send(method, key, query = {}, body, headers = {}) {
    const now = new Date().toISOString().replace(/[-:]|\.\d{3}/g, ''), day = now.slice(0, 8);
    const path = `/${bucket}${key ? '/' + key.split('/').map(encode).join('/') : ''}`;
    const qs = Object.keys(query).sort().map(k => `${encode(k)}=${encode(query[k])}`).join('&');
    const signed = { host, 'x-amz-content-sha256': 'UNSIGNED-PAYLOAD', 'x-amz-date': now, ...headers };
    const names = Object.keys(signed).map(k => k.toLowerCase()).sort();
    const canonical = [method, path, qs, names.map(k => `${k}:${String(signed[Object.keys(signed).find(h => h.toLowerCase() === k)]).trim()}\n`).join(''), names.join(';'), 'UNSIGNED-PAYLOAD'].join('\n');
    const scope = `${day}/auto/s3/aws4_request`, toSign = ['AWS4-HMAC-SHA256', now, scope, hex(canonical)].join('\n');
    const signature = createHmac('sha256', ['auto', 's3', 'aws4_request'].reduce(hmac, hmac(`AWS4${secret}`, day))).update(toSign).digest('hex');
    const r = await fetch(`https://${host}${path}${qs ? '?' + qs : ''}`, { method, body, headers: { ...signed, authorization: `AWS4-HMAC-SHA256 Credential=${keyId}/${scope}, SignedHeaders=${names.join(';')}, Signature=${signature}` } });
    if (!r.ok) throw new Error(`R2 answered ${r.status} for ${method} ${key || bucket}: ${(await r.text()).match(/<Message>([^<]*)/)?.[1] ?? ''}`);
    return r;
  }
  return {
    async *list(prefix) {
      for (let token; ;) {
        const xml = await (await send('GET', '', { 'list-type': '2', prefix, ...(token ? { 'continuation-token': token } : {}) })).text();
        for (const m of xml.matchAll(/<Contents>[\s\S]*?<Key>([^<]*)<\/Key>[\s\S]*?<Size>(\d+)<\/Size>[\s\S]*?<\/Contents>/g)) yield { key: m[1].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'"), size: Number(m[2]) };
        if (!/<IsTruncated>true<\/IsTruncated>/.test(xml)) return;
        token = /<NextContinuationToken>([^<]*)/.exec(xml)[1];
      }
    },
    async delete(key) { await send('DELETE', key); },
    async download(key, file) { await pipeline(Readable.fromWeb((await send('GET', key)).body), createWriteStream(file, { mode: 0o600 })); },
    async upload(key, file, contentType = 'application/octet-stream') {
      const size = statSync(file).size, fd = openSync(file, 'r'), read = (at, n) => { const b = Buffer.alloc(n); readSync(fd, b, 0, n, at); return b; };
      try {
        if (size <= PART) return void await send('PUT', key, {}, read(0, size), { 'content-type': contentType });
        const id = /<UploadId>([^<]*)/.exec(await (await send('POST', key, { uploads: '' }, undefined, { 'content-type': contentType })).text())[1], parts = [];
        for (let n = 1, at = 0; at < size; n++, at += PART) parts.push(`<Part><PartNumber>${n}</PartNumber><ETag>${(await send('PUT', key, { partNumber: String(n), uploadId: id }, read(at, Math.min(PART, size - at)))).headers.get('etag')}</ETag></Part>`);
        await send('POST', key, { uploadId: id }, `<CompleteMultipartUpload>${parts.join('')}</CompleteMultipartUpload>`);
      } finally { closeSync(fd); }
    },
  };
}
