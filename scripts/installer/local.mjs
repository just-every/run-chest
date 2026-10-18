import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { operatorInstaller, developmentTarget, previewTarget } from '@runeditrun/rer/operator-installer';
import { selectLocalState } from '@runeditrun/rer/local/state';
import { commandAdapter as createCommandAdapter } from '@runeditrun/rer/adapter';
import { deploy } from './deploy.mjs';
import { localPortability } from '@runeditrun/rer/portability';
import * as model from './ui/seed.mjs';

export { selectLocalState };
const lifecycle = operatorInstaller({
 database: 'foundation', features: model.features,
 async prepare({ root, input, store }) {
  // export and import run prepare without answers; the saved branding stays.
  if (input.APP_NAME === undefined && input.PRIMARY_COLOR === undefined) return;
  await store.step('Saving application branding');
  await writeFile(join(root, 'src/branding.json'), JSON.stringify({ name: input.APP_NAME, primaryColor: input.PRIMARY_COLOR }, null, 2) + '\n');
 },
});
export const adapter = lifecycle;
export const { install } = lifecycle;
export const commandAdapter = createCommandAdapter(lifecycle, {
 dev: developmentTarget, preview: previewTarget, verify: ['pnpm', ['run', 'verify:app']], deploy: deploy(lifecycle),
 portability: localPortability({ database: 'foundation', buckets: { originals: 'BLOBS' }, policy: { product: 'documents/chest', excludeTables: ['chest_mfa_factors', 'chest_mfa_challenges', 'chest_mfa_verified', 'chest_mfa_recovery', 'chest_mfa_limits', 'chest_mfa_resets', 'chest_assert', 'chest_storage_assert', 'chest_sso_config', 'chest_sso_transactions', 'chest_saml_requests', 'chest_scim_tokens', 'chest_scim_resources', 'chest_device_credentials', 'chest_reader'], buckets: { originals: { prefix: 'sha256/' } }, requiredConfiguration: ['OWNER_EMAIL', 'SESSION_SECRET', 'SETUP_TOKEN', 'AUTH_ORIGIN', 'MAIL_PROVIDER', 'MAIL_FROM'] }, transient: ['local runtime caches and logs'] }),
 publicPages: ['/', '/signin'],
 site: { entry: 'src/site/pages.tsx', output: 'dist/site', declaration: 'deploy-site.json', config: 'vite.site.config.ts' },
 setup: { manifestFile: 'rer-setup.json' }, browserModule: 'scripts/installer/ui/seed.mjs',
 // Local dev identity: the local-only Worker entry, the build output rer build
 // scans for the dev layer.
 devIdentity: { entry: 'src/server.dev.ts', output: ['dist'] },
 localOnlyKeys: ['RER_DEV_ORIGIN', 'RER_DEV_IDENTITY'],
 product: model.product.name, input: { names: { email: 'OWNER_EMAIL', name: 'displayName' }, async defaults(root) { const { readFile } = await import('node:fs/promises'); const branding = JSON.parse(await readFile(join(root, 'src/branding.json'), 'utf8')); return { APP_NAME: branding.name, PRIMARY_COLOR: branding.primaryColor }; } },
});
