import { readFile, rm } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { privateDirectory, writePrivateFile } from '@runeditrun/rer/private-files';
import { ownerDeploy } from '@runeditrun/rer/deploy';
import { missing, invalid } from '@runeditrun/rer/errors';

// A hosted Chest's mail is chosen with deploy settings, never by editing deploy.json: MAIL_PROVIDER (sendgrid or
// resend) and MAIL_FROM (a sender the provider has verified), from the environment or the --env-file. The key is
// MAIL_API_KEY, or the provider's own SENDGRID_API_KEY / RESEND_API_KEY. With no MAIL_PROVIDER, the one provider
// whose key is set is used. deploy.json's own mail values are only what `rer verify` serves locally.
// Docs: docs/hosting.md (https://run-chest.com/docs/hosting).
const keys = { sendgrid: 'SENDGRID_API_KEY', resend: 'RESEND_API_KEY' };
const address = /^(?:[^<>]*<)?[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+>?$/;
export function mailSettings(env) {
  const given = env.MAIL_PROVIDER?.trim(), key = env.MAIL_API_KEY?.trim();
  const configured = Object.keys(keys).filter(name => env[keys[name]]?.trim() || key && (name === 'sendgrid' ? key.startsWith('SG.') : key.startsWith('re_')));
  const provider = given || (configured.length === 1 ? configured[0] : undefined);
  if (!provider) throw missing(configured.length ? 'Both SendGrid and Resend keys are set. Choose one with MAIL_PROVIDER=sendgrid or MAIL_PROVIDER=resend. Nothing was deployed.' : 'Hosted Chest signs people in by email. Set MAIL_PROVIDER (sendgrid or resend), MAIL_FROM (a sender address your provider has verified) and that provider\'s API key (SENDGRID_API_KEY or RESEND_API_KEY). See https://run-chest.com/docs/hosting. Nothing was deployed.');
  if (!keys[provider]) throw invalid(`MAIL_PROVIDER must be sendgrid or resend, not ${provider}. Nothing was deployed.`);
  const from = env.MAIL_FROM?.trim();
  if (!from) throw missing(`Set MAIL_FROM to the sender address ${provider === 'sendgrid' ? 'SendGrid' : 'Resend'} has verified for you, for example MAIL_FROM=files@example.com. Nothing was deployed.`);
  if (!address.test(from) || /\.(invalid|test|example)>?$/.test(from)) throw invalid(`MAIL_FROM must be a real sender address your provider has verified (name@example.com or "Your Company <name@example.com>"), not ${from}. Nothing was deployed.`);
  const apiKey = key || env[keys[provider]]?.trim();
  if (!apiKey) throw missing(`Set ${keys[provider]} (or MAIL_API_KEY) to your ${provider === 'sendgrid' ? 'SendGrid' : 'Resend'} API key. Nothing was deployed.`);
  return { provider, from, apiKey };
}

export const deploy = lifecycle => {
  const base = ownerDeploy('deploy.json', lifecycle);
  return Object.assign(async context => {
    const { options, root } = context;
    // Removing a deployment or changing one secret keeps the mail the Worker already has.
    if (options.remove || options.setSecret || options.unsetSecret || options.rotateSecret) return base(context);
    let mail;
    try { mail = mailSettings(process.env); }
    catch (error) {
      // A dry run still builds and checks everything else, and says what a real deploy needs.
      if (!options.dryRun) throw error;
      context.store.report(`Needed for a real deploy: ${error.message.replace(' Nothing was deployed.', '')}`);
      return base(context);
    }
    const declaration = JSON.parse(await readFile(join(root, 'deploy.json'), 'utf8'));
    declaration.vars.MAIL_PROVIDER = mail.provider; declaration.vars.MAIL_FROM = mail.from;
    process.env.MAIL_API_KEY = mail.apiKey;
    context.store.report(`Mail: ${mail.provider === 'sendgrid' ? 'SendGrid' : 'Resend'}, sending from ${mail.from}.`);
    const directory = await privateDirectory(root, ['.seed', 'installer']);
    const path = join(directory, 'owner-deploy.json');
    await writePrivateFile(path, JSON.stringify(declaration) + '\n');
    try { return await ownerDeploy(relative(root, path), lifecycle)(context); }
    finally { await rm(path, { force: true }); }
  }, { declaration: 'deploy.json', managesHostedOwner: true });
};
