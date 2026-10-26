import { parseEnv } from 'node:util';
import { resolve } from 'node:path';
import { readPrivateFile } from '@runeditrun/rer/private-files';
import { readSettings } from '@runeditrun/rer/adapter-settings';
import { localOwners } from '@runeditrun/rer/internal/onboarding/local/owner.mjs';
import { mailSettings } from '../installer/deploy.mjs';

export class ServerConfigurationError extends Error {}
const fail = message => { throw new ServerConfigurationError(message); };

export async function serverSettings(root, args, inherited = process.env) {
  let supplied = {};
  if (args.length) {
    if (args.length !== 2 || args[0] !== '--env-file') fail('Usage: rer run server [--env-file PRIVATE_FILE]');
    try { supplied = parseEnv(await readPrivateFile(resolve(root, args[1]))); }
    catch { fail('The server env file must be an owned, private regular file (chmod 600).'); }
  }
  const env = { ...inherited, ...supplied };
  if (Object.entries(env).some(([key, value]) => value && /^(RER_DEV|RER_DEMO|RER_MODELS_|RER_LOCAL_STATE_PATH$|RER_RUNTIME_)/.test(key)) || env.AUTH_LOCAL === 'true') {
    fail('Remove development, demo and alternate-state settings from the server environment.');
  }
  let origin;
  try { origin = new URL(env.AUTH_ORIGIN); } catch { /* Fixed diagnostic below. */ }
  if (!origin || origin.protocol !== 'https:' || origin.origin !== env.AUTH_ORIGIN || origin.username || origin.password || !origin.hostname.includes('.') || /(?:^|\.)(?:localhost|local|test|invalid)$/.test(origin.hostname)) {
    fail('Set AUTH_ORIGIN to the exact HTTPS origin on your domain, without a path or trailing slash.');
  }
  const portText = env.CHEST_SERVER_PORT ?? '8787', port = Number(portText);
  if (!/^\d+$/.test(portText) || !Number.isInteger(port) || port < 1 || port > 65535) fail('CHEST_SERVER_PORT must be an integer from 1 through 65535.');
  let saved;
  try { saved = (await readSettings(root, { file: '.dev.vars' })).values; }
  catch { fail('Restore the private settings saved by rer setup before starting the server.'); }
  if (!saved.OWNER_EMAIL || !saved.SESSION_SECRET || !saved.SIGNING_KEY_SECRET) fail('Run rer setup --owner-email YOUR_EMAIL, then rer build before starting the server.');
  if (env.OWNER_EMAIL && env.OWNER_EMAIL !== saved.OWNER_EMAIL) fail('The server owner must match the owner saved by rer setup.');
  const owners = await localOwners(root);
  if (!owners.some(owner => owner.toLowerCase() === saved.OWNER_EMAIL.toLowerCase())) fail('Run rer setup with the saved owner before starting the server.');
  let mail;
  try { mail = mailSettings(env); }
  catch { fail('Configure MAIL_PROVIDER (sendgrid or resend), MAIL_FROM and MAIL_API_KEY or the provider API key in the private server environment.'); }
  return { origin, port, bindings: {
    ...saved, AUTH_LOCAL: 'false', AUTH_ORIGIN: origin.origin,
    MAIL_PROVIDER: mail.provider, MAIL_FROM: mail.from, MAIL_API_KEY: mail.apiKey,
  } };
}
