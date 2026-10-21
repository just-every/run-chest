// SIGN-001 through the built Worker: HTTP doors for requesters and signers; mail is received at the provider edge.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {PDFDocument,StandardFonts} from 'pdf-lib';
import {extractText,getDocumentProxy} from 'unpdf';
import {harness} from './harness.mjs';
const h=await harness(),b64=x=>Buffer.from(x).toString('base64'),sha=x=>createHash('sha256').update(x).digest('hex'),day=86_400_000;
const post=(path,data,cookie)=>h.fetch(path,{method:'POST',headers:{origin:h.origin,'content-type':'application/x-www-form-urlencoded',...(cookie?{cookie}:{})},body:new URLSearchParams(data).toString()});
const text=async r=>(await r.text()).replace(/\s+/g,' ');
async function contract(pages=2){const doc=await PDFDocument.create(),font=await doc.embedFont(StandardFonts.Helvetica);for(let i=1;i<=pages;i++){const p=doc.addPage([612,792]);p.drawText(`Services agreement page ${i}. The supplier delivers within thirty days.`,{x:56,y:700,size:12,font})}return Buffer.from(await doc.save())}
const mailsTo=email=>h.mails.filter(m=>[m.to].flat().includes(email));
const link=m=>new URL(m.text.match(/https?:\/\/[^\s]+\/sign\/[^\s]+/)[0]).pathname;
async function itemOf(cookie,id){return h.api(`/items/${id}`,cookie)}
async function download(cookie,item,version){const r=await h.fetch(`/api/chest/items/${item}/bytes/${version}?download=true`,{headers:{cookie}});assert.equal(r.status,200);return Buffer.from(await r.arrayBuffer())}
async function rewrite(id,change){const row=(await h.sql('SELECT payload FROM chest_records WHERE id=?',id)).results[0],p=JSON.parse(row.payload);change(p);await h.sql('UPDATE chest_records SET payload=? WHERE id=?',JSON.stringify(p),id)}
const fieldsFor=(emails)=>emails.flatMap((signer,i)=>[{signer,type:'signature',page:1,x:.1,y:.1+i*.1,w:.3,h:.05},{signer,type:'date',page:1,x:.5,y:.1+i*.1,w:.15,h:.03}]);
// A signer who is not staff: PIN by mail, then the cookie it earns.
async function verify(path,email){
 const before=mailsTo(email).length;assert.equal((await post(path+'/pin',{})).status,200);const pin=mailsTo(email).at(-1).text.match(/PIN is (\d{6})/)[1];assert.equal(mailsTo(email).length,before+1);
 const wrong=await post(path+'/verify',{pin:pin==='000000'?'111111':'000000'});assert.equal(wrong.status,403);
 const ok=await post(path+'/verify',{pin});assert.equal(ok.status,303);return ok.headers.getSetCookie()[0].split(';')[0];
}
const dir=mkdtempSync(join(tmpdir(),'chest-sign-'));
try{
 assert.equal((await h.raw('/auth/bootstrap',null,{token:h.vars.SETUP_TOKEN,displayName:'Alex Morgan'})).status,303);const owner=await h.signIn(h.vars.OWNER_EMAIL);await h.fetch('/setup',{method:'POST',headers:{cookie:owner,origin:h.origin,'content-type':'application/x-www-form-urlencoded'},body:'confirm=yes'});const space=(await h.api('/files',owner)).personal;
 await h.api('/people',owner,{action:'invite',email:'colleague@example.test',name:'Jordan Lee'});const colleague=await h.signIn('colleague@example.test',true);
 await h.api('/people',owner,{action:'invite',email:'viewer@example.test',name:'Vee Viewer'});const viewer=await h.signIn('viewer@example.test',true);
 const bytes=await contract(),file=await h.api('/items',owner,{space,name:'Services agreement.pdf',base64:bytes.toString('base64')}),other=await h.api('/items',owner,{space,name:'Private notes.txt',base64:b64('Not for signers')});
 const source=(await itemOf(owner,file.id)).versions[0];assert.equal(source.checksum,sha(bytes));
 await h.api(`/items/${file.id}/shares`,owner,{principal:'viewer@example.test',role:'viewer'});
 // Who may request: a viewer is refused; the owner's draft is created from the exact current version.
 await h.api('/signatures',viewer,{item:file.id},403);
 const draft=await h.api('/signatures',owner,{item:file.id});assert.equal(draft.payload.version,source.id);assert.equal(draft.payload.sourceKind,'pdf');
 await h.api(`/signatures/${draft.id}/send`,owner,{signers:[{email:'ext@outside.test',name:'Ellis Outside'}],fields:[]},422);
 // Two signers in order: the external signer first, then staff.
 const send=await h.api(`/signatures/${draft.id}/send`,owner,{signers:[{email:'ext@outside.test',name:'Ellis Outside'},{email:'colleague@example.test',name:'Jordan Lee'}],mode:'sequential',expiresDays:7,reminderDays:1,fields:fieldsFor(['ext@outside.test','colleague@example.test'])});assert.equal(send.status,'pending');
 assert.equal(mailsTo('ext@outside.test').length,1,'the first signer is invited');assert.equal(mailsTo('colleague@example.test').filter(m=>/asked you to sign/.test(m.subject)).length,0,'the second signer waits for their turn');
 const ext=link(mailsTo('ext@outside.test')[0]);
 // Nothing opens before the PIN; a made-up link answers nothing.
 assert.match(await text(await h.fetch(ext)),/Verify your email/);assert.doesNotMatch(await text(await h.fetch(ext)),/Services agreement page/);
 const noPin=await h.fetch(ext+'/document');assert.doesNotMatch(noPin.headers.get('content-type')||'',/pdf/);
 assert.equal((await h.fetch('/sign/chest_sign_'+'a'.repeat(43))).status,404);
 // A reminder reaches the first signer on the set cadence, once.
 await rewrite(draft.id,p=>{for(const s of p.signers)if(s.invitedAt)s.invitedAt=new Date(Date.now()-2*day).toISOString();p.sentAt=new Date(Date.now()-2*day).toISOString()});
 await h.scheduled();const reminders=mailsTo('ext@outside.test').filter(m=>/Reminder/.test(m.subject));assert.equal(reminders.length,1,'one reminder to the first signer');assert.equal(mailsTo('colleague@example.test').filter(m=>/Reminder/.test(m.subject)).length,0);
 await h.scheduled();assert.equal(mailsTo('ext@outside.test').filter(m=>/Reminder/.test(m.subject)).length,1,'no duplicate reminder in the same cadence');
 // PIN, consent disclosure, the document and nothing else.
 const cookie=await verify(ext,'ext@outside.test');
 const consent=await text(await h.fetch(ext,{headers:{cookie}}));assert.match(consent,/withdraw your consent/);assert.match(consent,/paper copy/);
 assert.equal((await post(ext+'/sign',{adopt:'Ellis Outside',intent:'true'},cookie)).status,409,'signing needs the consent first');
 assert.equal((await post(ext+'/consent',{},cookie)).status,303);
 const doc=await h.fetch(ext+'/document',{headers:{cookie}});assert.equal(doc.headers.get('content-type'),'application/pdf');assert.equal(sha(Buffer.from(await doc.arrayBuffer())),sha(bytes));
 const other1=await h.fetch(`/api/chest/items/${other.id}/bytes/${(await itemOf(owner,other.id)).versions[0].id}?download=true`,{headers:{cookie}});assert.equal(other1.status,401,'the signer holds no Chest access');
 assert.equal((await h.fetch(`/api/chest/items/${file.id}`,{headers:{cookie}})).status,401);
 assert.equal((await h.fetch(`/sign/${'chest_sign_'+'b'.repeat(43)}/document`,{headers:{cookie}})).status,404);
 const page=await text(await h.fetch(ext,{headers:{cookie}}));assert.match(page,/Adopt and sign/);assert.match(page,/Services agreement page 1/);assert.doesNotMatch(page,/Not for signers/);
 assert.equal((await post(ext+'/sign',{adopt:'Ellis Outside'},cookie)).status,422,'explicit intent is required');
 assert.equal((await post(ext+'/sign',{adopt:'Ellis Outside',intent:'true'},cookie)).status,303);
 assert.match(await text(await h.fetch(ext,{headers:{cookie}})),/You have signed/);
 // The staff signer is invited now; only their own sign-in opens it.
 const invitation=mailsTo('colleague@example.test').find(m=>/asked you to sign/.test(m.subject));assert.ok(invitation,'the staff signer is invited after the first signs');const staffPath=link(invitation);
 const anonymous=await h.fetch(staffPath);assert.equal(anonymous.status,303);assert.match(anonymous.headers.get('location'),/^\/signin\?returnTo=/);
 assert.equal((await h.fetch(staffPath,{headers:{cookie:viewer}})).status,403,'another staff member is refused');
 assert.match(await text(await h.fetch(staffPath,{headers:{cookie:colleague}})),/Electronic records/);
 assert.equal((await post(staffPath+'/consent',{},colleague)).status,303);
 const before=(await itemOf(owner,file.id));assert.equal(before.versions.length,1);
 {const r=await post(staffPath+'/sign',{adopt:'Jordan Lee',intent:'true'},colleague);assert.equal(r.status,303,await text(r))}
 // Two new versions linked to the source; the source and the current version are unchanged.
 const done=await itemOf(owner,file.id);assert.equal(done.versions.length,3);assert.equal(done.item.current,source.id);assert.equal(done.versions.find(v=>v.id===source.id).checksum,sha(bytes));
 const signedV=done.versions.find(v=>v.signature?.role==='signed'),certV=done.versions.find(v=>v.signature?.role==='certificate');assert.ok(signedV&&certV);assert.equal(signedV.signature.sourceVersion,source.id);assert.equal(certV.signature.sourceVersion,source.id);assert.equal(signedV.arrival,'signature');
 const signed=await download(owner,file.id,signedV.id),certificate=await download(owner,file.id,certV.id);assert.equal(sha(signed),signedV.checksum);
 // The PAdES signature validates, and fails after one byte changes.
 const good=await h.api('/signatures/validate',owner,{item:file.id,version:signedV.id});assert.equal(good.valid,true);assert.equal(good.coversWholeFile,true);assert.equal(good.issuedByThisInstallation,true);
 const tampered=Buffer.from(signed);tampered[200]^=1;const bad=await h.api('/signatures/validate',owner,{base64:tampered.toString('base64')});assert.equal(bad.valid,false);
 const appended=Buffer.concat([signed,Buffer.from('\n')]);assert.equal((await h.api('/signatures/validate',owner,{base64:appended.toString('base64')})).valid,false);
 assert.equal((await h.api('/signatures/validate',owner,{base64:certificate.toString('base64')})).valid,true,'the certificate is sealed too');
 // An independent validator (OpenSSL) agrees on the same bytes.
 const range=signed.toString('latin1').match(/\/ByteRange\s*\[\s*(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s*\]/).slice(1).map(Number),cms=Buffer.from(signed.toString('latin1').slice(range[1]+1,range[2]-1),'hex');
 writeFileSync(join(dir,'content.bin'),Buffer.concat([signed.subarray(0,range[1]),signed.subarray(range[2])]));writeFileSync(join(dir,'sig.der'),cms.subarray(0,(cms[1]&0x80?2+(cms[1]&0x7f)+parseInt(cms.subarray(2,2+(cms[1]&0x7f)).toString('hex'),16):2+cms[1])));
 execFileSync('openssl',['cms','-verify','-inform','DER','-in',join(dir,'sig.der'),'-binary','-content',join(dir,'content.bin'),'-noverify','-out','/dev/null'],{stdio:'pipe'});
 writeFileSync(join(dir,'content-bad.bin'),Buffer.concat([tampered.subarray(0,range[1]),tampered.subarray(range[2])]));assert.throws(()=>execFileSync('openssl',['cms','-verify','-inform','DER','-in',join(dir,'sig.der'),'-binary','-content',join(dir,'content-bad.bin'),'-noverify','-out','/dev/null'],{stdio:'pipe'}));
 // The audit certificate: signers, methods, every event with address and agent, and the hashes before and after.
 const proxy=await getDocumentProxy(new Uint8Array(certificate)),words=(await extractText(proxy,{mergePages:true})).text.replace(/\s+/g,' ');
 for(const expected of ['ext@outside.test','colleague@example.test','one-time PIN','staff sign-in','sent','viewed','consented','signed',source.checksum,signedV.checksum,'IP'])assert.ok(words.includes(expected),`certificate lists ${expected}`);
 // The request record: full event log, outcome, hashes; reminders stop; every signer got the completed copy by email.
 const record=await h.api(`/signatures/${draft.id}`,owner);assert.equal(record.status,'completed');assert.deepEqual(record.events.map(e=>e.type).filter((t,i,a)=>a.indexOf(t)===i).sort(),['completed','consented','invited','reminder','sent','signed','verified','viewed'].sort());assert.ok(record.events.every(e=>e.ip&&e.agent));
 assert.equal(record.signed.checksum,signedV.checksum);assert.equal(record.certificate.checksum,certV.checksum);
 for(const email of ['ext@outside.test','colleague@example.test'])assert.equal(mailsTo(email).filter(m=>/^Signed:/.test(m.subject)).length,1,`${email} receives the completed copy`);
 await rewrite(draft.id,p=>{for(const s of p.signers){delete s.remindedAt;s.invitedAt=new Date(Date.now()-9*day).toISOString()}});const mailCount=h.mails.length;await h.scheduled();assert.equal(h.mails.length,mailCount,'a completed request sends no reminders');
 // Each signer reaches exactly the completed pair, byte for byte.
 const completedLink=link(mailsTo('ext@outside.test').find(m=>/^Signed:/.test(m.subject)));assert.equal(completedLink,ext);
 assert.match(await text(await h.fetch(ext,{headers:{cookie}})),/Download the signed PDF/);const again=await h.fetch(ext+'/signed',{headers:{cookie}});assert.equal(sha(Buffer.from(await again.arrayBuffer())),signedV.checksum);
 assert.notEqual((await h.fetch(ext+'/signed')).headers.get('content-type'),'application/pdf','the completed copy needs verification too');
 assert.equal((await post(ext+'/sign',{adopt:'Ellis Outside',intent:'true'},cookie)).status,409,'a completed request takes no more signatures');
 const audit=await h.api(`/audit?object=${file.id}`,owner);for(const a of ['signature.draft','signature.send','signature.sign','signature.complete'])assert.ok(audit.some(r=>r.action===a),a);
 console.log('SIGN-001 two-signer PDF, PIN, consent, PAdES seal, certificate, reminders and distribution passed');
 // A DOCX is rendered to PDF with a fidelity report the requester sees before sending.
 const docx=readFileSync(new URL('./memo.docx',import.meta.url)),memo=await h.api('/items',owner,{space,name:'Memo.docx',base64:docx.toString('base64')});
 const dd=await h.api('/signatures',owner,{item:memo.id}),mv=(await itemOf(owner,memo.id)).versions[0];assert.equal(dd.payload.sourceKind,'docx');assert.equal(dd.payload.rendition.sourceChecksum??mv.checksum,mv.checksum);assert.equal(dd.payload.sourceChecksum,mv.checksum);assert.ok(dd.payload.rendition.fidelity.summary);
 const compose=await text(await h.fetch(`/app/signatures/${dd.id}`,{headers:{cookie:owner}}));assert.match(compose,/Fidelity report/);assert.match(compose,/Rendered \d+ page/);
 await h.api(`/signatures/${dd.id}/send`,owner,{signers:[{email:'ext@outside.test'}],fields:fieldsFor(['ext@outside.test']),reminderDays:null});
 const renditionPdf=await h.fetch(link(mailsTo('ext@outside.test').at(-1))+'/document',{headers:{cookie:await verify(link(mailsTo('ext@outside.test').at(-1)),'ext@outside.test')}});assert.equal(renditionPdf.headers.get('content-type'),'application/pdf');assert.equal(sha(Buffer.from(await renditionPdf.arrayBuffer())),dd.payload.rendition.checksum);
 await h.api(`/signatures/${dd.id}/void`,owner,{reason:'test cleanup'});
 // Declined, expired and voided requests leave the source unsigned and file nothing.
 const state=async()=>{const i=await itemOf(owner,file.id);return JSON.stringify([i.versions.length,i.item.current])};const unchanged=await state();
 const open=async(emails,extra={})=>{const d=await h.api('/signatures',owner,{item:file.id,version:source.id});await h.api(`/signatures/${d.id}/send`,owner,{signers:emails.map(email=>({email})),fields:fieldsFor(emails),expiresDays:3,reminderDays:1,...extra});return d.id};
 const declined=await open(['ext@outside.test']),declinePath=link(mailsTo('ext@outside.test').at(-1)),dc=await verify(declinePath,'ext@outside.test');await post(declinePath+'/consent',{},dc);
 assert.equal((await post(declinePath+'/decline',{reason:''},dc)).status,422);assert.equal((await post(declinePath+'/decline',{reason:'The price is wrong'},dc)).status,303);
 const dr=await h.api(`/signatures/${declined}`,owner);assert.equal(dr.status,'declined');assert.equal(dr.outcome.reason,'The price is wrong');assert.equal(await state(),unchanged);assert.equal((await post(declinePath+'/sign',{adopt:'Ellis',intent:'true'},dc)).status,410);
 const expiring=await open(['ext@outside.test']),expiringPath=link(mailsTo('ext@outside.test').at(-1)),ec=await verify(expiringPath,'ext@outside.test');await post(expiringPath+'/consent',{},ec);
 await rewrite(expiring,p=>{p.expires=new Date(Date.now()-1000).toISOString()});assert.equal((await post(expiringPath+'/sign',{adopt:'Ellis Outside',intent:'true'},ec)).status,410);
 const er=await h.api(`/signatures/${expiring}`,owner);assert.equal(er.status,'expired');assert.equal(er.outcome.status,'expired');assert.equal(await state(),unchanged);
 const voided=await open(['ext@outside.test','colleague@example.test']),voidPath=link(mailsTo('ext@outside.test').at(-1)),vc=await verify(voidPath,'ext@outside.test');await post(voidPath+'/consent',{},vc);
 await h.api(`/signatures/${voided}/void`,viewer,{},403);await h.api(`/signatures/${voided}/void`,owner,{reason:'wrong version'});
 assert.equal((await post(voidPath+'/sign',{adopt:'Ellis Outside',intent:'true'},vc)).status,410);assert.equal((await h.api(`/signatures/${voided}`,owner)).status,'voided');assert.equal(await state(),unchanged);
 // PIN guesses are limited, and a resent link replaces the old one.
 const guarded=await open(['ext@outside.test']),guardPath=link(mailsTo('ext@outside.test').at(-1));await post(guardPath+'/pin',{});const pin=mailsTo('ext@outside.test').at(-1).text.match(/PIN is (\d{6})/)[1];
 for(let i=0;i<5;i++)await post(guardPath+'/verify',{pin:pin==='123456'?'654321':'123456'});assert.equal((await post(guardPath+'/verify',{pin})).status,403,'five wrong PINs burn it');
 const resent=await h.api(`/signatures/${guarded}/remind`,owner,{signer:(await h.api(`/signatures/${guarded}`,owner)).signers[0].id});assert.match(resent.mail,/accepted|suppressed/);const fresh=link(mailsTo('ext@outside.test').at(-1));assert.notEqual(fresh,guardPath);assert.equal((await h.fetch(guardPath)).status,404);assert.match(await text(await h.fetch(fresh)),/Verify your email/);
 // Custody and retention: the key is sealed, no view carries a link hash or PIN credential, and erasing the file erases its requests and signed copies.
 const key=(await h.sql('SELECT key_sealed,certificate FROM chest_signing_key')).results[0];assert.match(key.key_sealed,/^v1\./);const view=JSON.stringify(await h.api(`/signatures/${draft.id}`,owner));assert.doesNotMatch(view,/tokenHash|credential|chest_sign_/);
 await h.api(`/items/${file.id}/trash`,owner,{});const receipt=await h.api('/erasure',owner,{item:file.id});assert.equal(receipt.payload.state,'complete');
 assert.equal((await h.raw(`/api/chest/signatures/${draft.id}`,owner)).status,404);assert.equal((await h.fetch(ext)).status,404,'the signer link stops with the file');assert.equal((await h.fetch(ext+'/signed',{headers:{cookie}})).status,404);
 assert.equal((await h.sql("SELECT COUNT(*) n FROM chest_records WHERE kind='signature' AND json_extract(payload,'$.item')=?",file.id)).results[0].n,0);
 console.log('SIGN-001 DOCX fidelity report, declined, expired, voided, PIN limits, resend, custody and erasure passed');
}finally{rmSync(dir,{recursive:true,force:true});await h.close()}
