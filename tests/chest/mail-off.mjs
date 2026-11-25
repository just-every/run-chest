import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { ownerSigninDigest } from '../../src/modules/operator-auth/owner-signin-grant.mjs';
import { harness } from './harness.mjs';

const h = await harness({ bindings: { MAIL_PROVIDER: 'none', MAIL_FROM: undefined, MAIL_API_KEY: undefined } });
try {
 assert.equal((await h.raw('/health')).status, 200);
 assert.equal((await h.raw('/auth/bootstrap', null, { token: h.vars.SETUP_TOKEN, displayName: 'Alex Morgan' })).status, 303);

 const email = h.vars.OWNER_EMAIL;
 const signin = await h.raw('/signin');
 assert.equal(signin.status, 200);
 assert.ok(!(await signin.text()).includes('action="/auth/magic-link"'));
 const emailLink = await h.raw('/auth/magic-link', null, { email, returnTo: '/app/files' });
 assert.equal(emailLink.status, 503);
 assert.equal((await emailLink.json()).error, 'mail_off');

 // Cloudflare D1 is the network edge rer signin uses to insert this one-time grant.
 const token = randomBytes(32).toString('base64url'), at = Date.now();
 const grant = await h.sql(`INSERT INTO oa_owner_signins(id,token_hash,operator_id,operator_version,created_at,expires_at)
  SELECT ?,?,id,version,?,? FROM oa_operators WHERE email=? AND role='owner'`,
  randomUUID(), await ownerSigninDigest(token), at, at + 60_000, email);
 assert.equal(grant.meta.changes, 1);

 const confirmation = await h.fetch('/auth/owner-signin?' + new URLSearchParams({ token }));
 assert.equal(confirmation.status, 200);
 const session = await h.raw('/auth/owner-signin', null, { token });
 assert.equal(session.status, 303);
 const cookie = session.headers.getSetCookie().map(value => value.split(';')[0]).join('; ');
 assert.equal((await h.raw('/auth/owner-signin', null, { token })).status, 400);

 const setup = await h.fetch('/setup', { method: 'POST', headers: { cookie, origin: h.origin, 'content-type': 'application/x-www-form-urlencoded' }, body: 'confirm=yes' });
 assert.equal(setup.status, 303);
 const files = await h.api('/files', cookie);
 await h.api('/items', cookie, { space: files.personal, type: 'folder', name: 'Supplier agreements' });
 assert.equal((await h.raw('/app/files', cookie)).status, 200);
 const invite = await h.api('/people', cookie, { action: 'invite', email: 'sam@example.test', name: 'Sam Taylor' }, 503);
 assert.equal(invite.error, 'mail_off');
 assert.equal(h.mails.length, 0);
 console.log('Mail-off Worker starts without mail bindings, refuses email, and a one-time owner grant opens the workspace.');
} finally {
 await h.close();
}
