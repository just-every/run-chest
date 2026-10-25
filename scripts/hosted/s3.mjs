// Path-style S3 API over HTTPS with region-scoped AWS Signature V4.
import { createHash, createHmac } from 'node:crypto';
import { createWriteStream, openSync, readSync, closeSync, statSync } from 'node:fs';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
const decode = value => value.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
const escape = value => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');

const PART = 64 * 1024 * 1024;
const hex = data => createHash('sha256').update(data).digest('hex');
const hmac = (key, data) => createHmac('sha256', key).update(data).digest();
const encode = s => encodeURIComponent(s).replace(/[!'()*]/g, c => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);

export function s3({ endpoint, region, accessKeyId, secretAccessKey, sessionToken }, bucket, transport = fetch) {
  const base = new URL(endpoint), host = base.host;
  async function send(method, key, query = {}, body, headers = {}) {
    const now = new Date().toISOString().replace(/[-:]|\.\d{3}/g, ''), day = now.slice(0, 8);
    const path = `/${encode(bucket)}${key ? '/' + key.split('/').map(encode).join('/') : ''}`;
    const qs = Object.keys(query).sort().map(k => `${encode(k)}=${encode(query[k])}`).join('&');
    const signed = { host, 'x-amz-content-sha256': 'UNSIGNED-PAYLOAD', 'x-amz-date': now, ...(sessionToken ? { 'x-amz-security-token': sessionToken } : {}), ...headers };
    const names = Object.keys(signed).map(k => k.toLowerCase()).sort();
    const canonical = [method, path, qs, names.map(k => `${k}:${String(signed[Object.keys(signed).find(h => h.toLowerCase() === k)]).trim()}\n`).join(''), names.join(';'), 'UNSIGNED-PAYLOAD'].join('\n');
    const scope = `${day}/${region}/s3/aws4_request`, toSign = ['AWS4-HMAC-SHA256', now, scope, hex(canonical)].join('\n');
    const signature = createHmac('sha256', [region, 's3', 'aws4_request'].reduce(hmac, hmac(`AWS4${secretAccessKey}`, day))).update(toSign).digest('hex');
    const r = await transport(`https://${host}${path}${qs ? '?' + qs : ''}`, { method, body, redirect: 'error', headers: { ...signed, authorization: `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${scope}, SignedHeaders=${names.join(';')}, Signature=${signature}` } });
    if (!r.ok) { await r.body?.cancel(); throw new Error(`Object store refused ${method} (${r.status}).`); }
    if (method === 'PUT' || method === 'DELETE') await r.arrayBuffer();
    return r;
  }
  return {
    async *list(prefix) {
      for (let token; ;) {
        const xml = await (await send('GET', '', { 'list-type': '2', prefix, ...(token ? { 'continuation-token': token } : {}) })).text();
        for (const m of xml.matchAll(/<Contents>[\s\S]*?<Key>([^<]*)<\/Key>[\s\S]*?<Size>(\d+)<\/Size>[\s\S]*?<\/Contents>/g)) yield { key: decode(m[1]), size: Number(m[2]) };
        if (!/<IsTruncated>true<\/IsTruncated>/.test(xml)) return;
        const next = /<NextContinuationToken>([^<]*)/.exec(xml)?.[1];
        if (!next || decode(next) === token) throw new Error('Object store returned an invalid listing cursor.');
        token = decode(next);
      }
    },
    async delete(key) { await send('DELETE', key); },
    async download(key, file) { await pipeline(Readable.fromWeb((await send('GET', key)).body), createWriteStream(file, { mode: 0o600 })); },
    async upload(key, file, contentType = 'application/octet-stream') {
      const size = statSync(file).size, fd = openSync(file, 'r'), read = (at, n) => { const b = Buffer.alloc(n); readSync(fd, b, 0, n, at); return b; };
      try {
        if (size <= PART) return void await send('PUT', key, {}, read(0, size), { 'content-type': contentType });
        const id = decode(/<UploadId>([^<]*)/.exec(await (await send('POST', key, { uploads: '' }, undefined, { 'content-type': contentType })).text())?.[1] ?? '');
        if (!id) throw new Error('Object store did not begin a multipart upload.');
        try {
          const parts = [];
          for (let n = 1, at = 0; at < size; n++, at += PART) {
            const etag = (await send('PUT', key, { partNumber: String(n), uploadId: id }, read(at, Math.min(PART, size - at)))).headers.get('etag');
            if (!etag) throw new Error('Object store did not acknowledge an uploaded part.');
            parts.push(`<Part><PartNumber>${n}</PartNumber><ETag>${escape(etag)}</ETag></Part>`);
          }
          const result = await (await send('POST', key, { uploadId: id }, `<CompleteMultipartUpload>${parts.join('')}</CompleteMultipartUpload>`, { 'content-type': 'application/xml' })).text();
          if (!/<CompleteMultipartUploadResult[\s>]/.test(result) || /<Error[\s>]/.test(result)) throw new Error('Object store did not complete the multipart upload.');
        } catch (error) {
          await send('DELETE', key, { uploadId: id }).catch(() => {});
          throw error;
        }
      } finally { closeSync(fd); }
    },
  };
}
