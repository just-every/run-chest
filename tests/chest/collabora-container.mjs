import assert from 'node:assert/strict';
import {execFileSync,spawnSync} from 'node:child_process';
import {mkdir,mkdtemp,rm} from 'node:fs/promises';
import {join} from 'node:path';

// Both services and the browser share the Linux network, including on Docker Desktop hosts.
// The only host directory exposed to CODE contains this journey's short-lived test certificate.
const root=process.cwd(),dockerEnv={...process.env};
for(const key of ['DOCKER_HOST','DOCKER_CONTEXT','DOCKER_TLS','DOCKER_TLS_VERIFY','DOCKER_CERT_PATH'])delete dockerEnv[key];
const docker=args=>execFileSync('docker',['--host=unix:///var/run/docker.sock',...args],{env:dockerEnv,stdio:'inherit'});
assert.equal(execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim(),'','commit the candidate before its live journey');
await mkdir(join(root,'.cache'),{recursive:true});await mkdir(join(root,'test-results'),{recursive:true});
const temporary=await mkdtemp(join(root,'.cache','code-live-')),image=`chest-role-live:${crypto.randomUUID()}`;
let built=false;
try{
 docker(['build','--file','tests/chest/collabora-live.Dockerfile','--tag',image,'.']);built=true;
 docker(['run','--rm','--network','host','--mount','type=bind,src=/var/run/docker.sock,dst=/var/run/docker.sock','--mount',`type=bind,src=${temporary},dst=${temporary}`,'--mount',`type=bind,src=${join(root,'test-results')},dst=/work/test-results`,'--env',`TMPDIR=${temporary}`,image]);
}finally{
 if(built)spawnSync('docker',['--host=unix:///var/run/docker.sock','image','rm',image],{env:dockerEnv,stdio:'ignore'});
 await rm(temporary,{recursive:true,force:true});
}
