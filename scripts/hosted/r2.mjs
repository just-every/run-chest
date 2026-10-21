// Cloudflare API token to R2 S3 credentials; object transport is shared with S3 backups.
import { createHash } from 'node:crypto';
import { cloudflare } from './account.mjs';
import { s3 } from './s3.mjs';

export async function r2(creds, bucket) {
  const verified = await cloudflare(creds, '/tokens/verify').catch(() => null) ?? await fetch('https://api.cloudflare.com/client/v4/user/tokens/verify', { headers: { authorization: `Bearer ${creds.token}` } }).then(r => r.json());
  const accessKeyId = verified?.result?.id;
  if (!accessKeyId) throw new Error('Cloudflare did not confirm this API token, so its R2 access could not be used.');
  return s3({ endpoint: `https://${creds.account}.r2.cloudflarestorage.com`, region: 'auto', accessKeyId, secretAccessKey: createHash('sha256').update(creds.token).digest('hex') }, bucket);
}
