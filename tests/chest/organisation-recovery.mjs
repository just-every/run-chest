// ADMIN-001: the installation-side owner grant is issued exactly as rer signin issues it.
// The protected HTTP consumer, one-use proof and live session admission remain the real product.
import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
import {ownerSigninDigest} from '../../src/modules/operator-auth/owner-signin-grant.mjs';
export async function ownerRecovery(h,owner){
 await h.api('/organisation/domains',owner,{allowedDomains:['example.test','admin.test'],requiredDomains:['admin.test']});
 assert.equal((await h.raw('/api/chest/library',owner)).status,401,'ordinary owner email session also obeys domain enforcement');
 assert.equal((await h.raw('/auth/magic-link',null,{email:h.vars.OWNER_EMAIL})).status,403);
 const token=randomBytes(32).toString('base64url'),at=Date.now();await h.sql('INSERT INTO oa_owner_signins(id,token_hash,operator_id,operator_version,created_at,expires_at) SELECT ?,?,id,version,?,? FROM oa_operators WHERE email=?',randomUUID(),await ownerSigninDigest(token),at,at+900000,h.vars.OWNER_EMAIL);
 assert.equal((await h.fetch('/auth/owner-signin?'+new URLSearchParams({token}))).status,200);
 const consumed=await h.raw('/auth/owner-signin',null,{token});assert.equal(consumed.status,303);const cookie=consumed.headers.getSetCookie().map(v=>v.split(';')[0]).join('; ');
 assert.equal((await h.raw('/api/chest/library',cookie)).status,200,'protected installation owner recovers despite a required-provider domain');assert.equal((await h.raw('/auth/owner-signin',null,{token})).status,400,'owner recovery is one use');
 return cookie;
}
