import assert from 'node:assert/strict';
import {randomBytes,createHash} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';

// A real owner-authorized webhook is the denied network canary. No provider
// response is substituted: the runtime refuses before making the connection.
export async function proveIndependent(client,parent,label) {
 const random=()=>randomBytes(32).toString('base64url');
 const app=await client.api('/integrations/clients',{name:'Owner independence '+label,redirects:['https://client.example.com/callback'],actions:['read','upload','webhook'],confidential:true});
 const verifier=random(),challenge=createHash('sha256').update(verifier).digest('base64url');
 const params=new URLSearchParams({client_id:app.client.id,redirect_uri:'https://client.example.com/callback',response_type:'code',code_challenge_method:'S256',code_challenge:challenge,state:random(),scope:'read upload webhook',resource:parent});
 const consent=await client.context.request.get(client.origin+'/oauth/chest/authorize?'+params);
 assert.equal(consent.status(),200);const intent=/name="intent" value="([^"]+)"/.exec(await consent.text())?.[1];assert.ok(intent);
 const approved=await client.context.request.post(client.origin+'/oauth/chest/authorize',{headers:{origin:client.origin},form:{intent,decision:'allow'},maxRedirects:0});
 assert.equal(approved.status(),303);const callback=new URL(approved.headers()['location']);
 const exchange=await client.context.request.post(client.origin+'/oauth/chest/token',{headers:{origin:'https://client.example.com'},form:{grant_type:'authorization_code',client_id:app.client.id,client_secret:app.clientSecret,redirect_uri:'https://client.example.com/callback',code:callback.searchParams.get('code'),code_verifier:verifier}});
 assert.equal(exchange.status(),200);const token=(await exchange.json()).access_token;
 async function api(path,body,key) {
  const response=await client.context.request.fetch(client.origin+'/api/chest/integrations/v1'+path,{method:body===undefined?'GET':'POST',headers:{authorization:'Bearer '+token,...(key?{'idempotency-key':key}:{}),...(body?{'content-type':'application/json'}:{})},...(body?{data:body}:{})});
  assert.equal(response.status(),200,'the owner-authorized independence canary is admitted');return response.json();
 }
 const hook=await api('/webhooks',{endpoint:'https://runeditrun.com/own-independence',events:['file.upload']},'independence-hook-'+label);
 const bytes=Buffer.from('Independent staff original '+label),file=await client.api('/items',{parent,name:'Independent original '+label+'.txt',base64:bytes.toString('base64')});
 let denied;
 for(let n=0;n<30;n++){
  denied=(await api(`/webhooks/${hook.subscription.id}/deliveries`)).items.find(row=>row.reason==='outbound_host_denied');
  if(denied)break;await delay(1000);
 }
 assert.equal(denied?.state,'failed','Run Edit Run egress is refused by the running installation');
 const download=await client.request(`/items/${file.id}/bytes/${file.payload.versions[0].id}?download=true`);
 assert.deepEqual(await download.body(),bytes,'the same restricted installation continues serving the original');
 console.log('OWN_INDEPENDENT '+label+' denied all hosts except the real mail provider and continued serving staff.');
}
