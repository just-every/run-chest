// The hosted Chest an environment names, in the Cloudflare account that deployed it. Resource names follow rer's
// deploy kit: Worker chest-<environment>, D1 database chest-<environment>-db, R2 bucket chest-<environment>-blobs.
import { readFileSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

export function args(argv, usage) {
  const out = { environment: 'production' };
  argv = argv[0] === '--' ? argv.slice(1) : argv;
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i], value = argv[i + 1];
    if (flag === '--help' || flag === '-h') { console.log(usage); process.exit(0); }
    const key = { '--environment': 'environment', '--output': 'output', '--input': 'input', '--env-file': 'envFile' }[flag];
    if (!key || !value) fail(`${flag} is not understood.\n${usage}`);
    out[key] = value; i++;
  }
  return out;
}
export function fail(message) { console.error(message); process.exit(2); }
// Anything unexpected (Cloudflare or R2 refusing, the network dropping) ends with one plain line, not a stack trace.
for (const event of ['uncaughtException', 'unhandledRejection']) process.on(event, error => { const m = String(error?.message ?? error).trim(); fail(`Stopped: ${m}${/[.?!]$/.test(m) ? '' : '.'} Check your connection and the Cloudflare settings in your env file, then run the same command again.`); });

// Cloudflare credentials from the environment, or an owner-only KEY=VALUE file (the same one rer deploy takes).
export function credentials(envFile) {
  const env = { ...process.env };
  if (envFile) {
    const mode = statSync(envFile).mode & 0o777;
    if (mode & 0o077) fail(`${envFile} must be readable only by you (chmod 600 ${envFile}).`);
    for (const line of readFileSync(envFile, 'utf8').split('\n')) { const m = /^\s*(?:export\s+)?([A-Z][A-Z0-9_]*)=(.*)$/.exec(line); if (m) env[m[1]] = m[2].trim().replace(/^(['"])(.*)\1$/, '$2'); }
  }
  for (const name of ['CLOUDFLARE_ACCOUNT_ID', 'CLOUDFLARE_API_TOKEN']) if (!env[name]?.trim()) fail(`${name} is needed: use the same Cloudflare account ID and API token that deployed this Chest (see run-chest.com/docs/hosting).`);
  return { account: env.CLOUDFLARE_ACCOUNT_ID.trim(), token: env.CLOUDFLARE_API_TOKEN.trim(), env };
}

export function names(environment) {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(environment)) fail('--environment is the name you deployed with, for example production.');
  const worker = `chest-${environment}`;
  return { worker, database: `${worker}-db`, bucket: `${worker}-blobs` };
}

export async function cloudflare(creds, path, init = {}, transport = fetch) {
  const r = await transport(`https://api.cloudflare.com/client/v4/accounts/${creds.account}${path}`, { ...init, headers: { authorization: `Bearer ${creds.token}`, ...(init.body ? { 'content-type': 'application/json' } : {}), ...init.headers } });
  const data = await r.json().catch(() => ({}));
  if (!r.ok || data.success === false) throw new Error(`Cloudflare answered ${r.status} for ${init.method ?? 'GET'} ${path.split('?')[0]}: ${(data.errors ?? []).map(e => e.message).join('; ') || 'no detail'}`);
  return data;
}

export async function databaseId(creds, name) {
  const found = (await cloudflare(creds, `/d1/database?name=${encodeURIComponent(name)}`)).result.find(d => d.name === name);
  if (!found) fail(`No D1 database named ${name} in this account. Check --environment and that these are the credentials that deployed it.`);
  return found.uuid;
}

export async function query(creds, id, sql, transport) {
  return (await cloudflare(creds, `/d1/database/${id}/query`, { method: 'POST', body: JSON.stringify({ sql }) }, transport)).result[0].results;
}

// Wrangler from this checkout, with only the deploying account's credentials. Its output stays hidden: an export
// prints a presigned download link to the whole database. A failure shows wrangler's words with links removed.
export function wrangler(creds, argv) {
  const r = spawnSync('npx', ['wrangler', ...argv], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, CLOUDFLARE_ACCOUNT_ID: creds.account, CLOUDFLARE_API_TOKEN: creds.token, WRANGLER_SEND_METRICS: 'false' } });
  if (r.status !== 0) fail(`wrangler ${argv.slice(0, 3).join(' ')} failed (exit ${r.status}). Nothing after this step was done.\n${`${r.stdout}\n${r.stderr}`.replace(/https?:\/\/\S+/g, '<link removed>').trim().split('\n').slice(-8).join('\n')}`);
}
