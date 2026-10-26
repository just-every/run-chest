import assert from 'node:assert/strict';
import {writeFile,mkdtemp,chmod,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';

export async function ownerTunnel(port) {
 const account=process.env.CLOUDFLARE_ACCOUNT_ID,token=process.env.CHEST_TUNNEL_API_TOKEN;
 assert.equal(account,'b20c0ca9cab0c2b70e13d7cf724b89bd');assert.ok(token);
 const hostname='own-test.run-chest.com';
 async function api(path,{method='GET',body}={}) {
  const response=await fetch('https://api.cloudflare.com/client/v4'+path,{method,headers:{authorization:`Bearer ${token}`,'content-type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(60000),redirect:'error'});
  const data=await response.json().catch(()=>null);
  assert.ok(response.ok&&data?.success,`Tunnel API ${method} refused (${response.status}).`);return data;
 }
 const zones=(await api('/zones?name=run-chest.com')).result;assert.equal(zones.length,1);const zone=zones[0].id;
 async function records(){const rows=[];for(let page=1;;page++){const data=await api(`/zones/${zone}/dns_records?per_page=5000&page=${page}`);rows.push(...data.result);if(page>=data.result_info.total_pages)break;}return rows.sort((a,b)=>a.id.localeCompare(b.id));}
 const before=await records();assert.ok(!before.some(record=>record.name===hostname),'the isolated hostname must be unused');
 await writeFile('test-results/own-dns-before.json',JSON.stringify(before,null,2)+'\n',{mode:0o600});
 let tunnel,record,connector,closed,directory;
 async function close() {
  if(connector&&connector.exitCode===null&&connector.signalCode===null)connector.kill('SIGTERM');await closed;
  if(record){await api(`/zones/${zone}/dns_records/${record.id}`,{method:'DELETE'});record=null;}
  if(tunnel){await api(`/accounts/${account}/cfd_tunnel/${tunnel.id}/connections`,{method:'DELETE'});await api(`/accounts/${account}/cfd_tunnel/${tunnel.id}`,{method:'DELETE'});tunnel=null;}
  const after=await records();await writeFile('test-results/own-dns-after.json',JSON.stringify(after,null,2)+'\n',{mode:0o600});
  assert.deepEqual(after,before,'the complete zone is identical to its original snapshot');
  await rm(directory??'',{recursive:true,force:true});
  console.log('OWN_DNS_RESTORED originalRecords='+before.length+' diff=empty tunnelRemoved=true');
 }
 try {
  tunnel=(await api(`/accounts/${account}/cfd_tunnel`,{method:'POST',body:{name:'chest-own-i813-'+randomUUID().slice(0,8),config_src:'cloudflare'}})).result;
  assert.match(tunnel.id,/^[a-f0-9-]{36}$/);
  await api(`/accounts/${account}/cfd_tunnel/${tunnel.id}/configurations`,{method:'PUT',body:{config:{ingress:[{hostname,service:`http://127.0.0.1:${port}`,originRequest:{httpHostHeader:hostname}},{service:'http_status:404'}]}}});
  record=(await api(`/zones/${zone}/dns_records`,{method:'POST',body:{type:'CNAME',name:hostname,content:tunnel.id+'.cfargotunnel.com',proxied:true,ttl:1}})).result;
  const tunnelToken=(await api(`/accounts/${account}/cfd_tunnel/${tunnel.id}/token`)).result;assert.equal(typeof tunnelToken,'string');
  directory=await mkdtemp(join(tmpdir(),'chest-own-tunnel-'));const binary=join(directory,'cloudflared');
  const response=await fetch('https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64',{signal:AbortSignal.timeout(120000)});assert.ok(response.ok);await writeFile(binary,new Uint8Array(await response.arrayBuffer()),{mode:0o700});await chmod(binary,0o700);
  connector=spawn(binary,['tunnel','--no-autoupdate','run'],{env:{...process.env,TUNNEL_TOKEN:tunnelToken},stdio:['ignore','pipe','pipe']});connector.stdout.resume();connector.stderr.resume();closed=new Promise(resolve=>connector.once('close',resolve));
  return {origin:'https://'+hostname,close};
 }catch(error){await close();throw error;}
}
