import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {readFile,unlink,mkdir} from 'node:fs/promises';
import {setTimeout as delay} from 'node:timers/promises';

export async function receiveSecrets() {
 const pipe=process.argv[2];assert.match(pipe,/^\/tmp\/sx-chest-i813-[a-z-]+\.pipe$/);
 const {execFileSync}=await import('node:child_process');execFileSync('mkfifo',['-m','600',pipe]);
 console.log('OWN_SECRET_PIPE '+pipe);
 try {Object.assign(process.env,JSON.parse(await readFile(pipe,'utf8')));}finally{await unlink(pipe);}
 await mkdir('test-results',{recursive:true});
}

export function running(args,env=process.env) {
 const child=spawn('pnpm',['exec','rer',...args],{env:{...env,CI:'true',WRANGLER_SEND_METRICS:'false'},detached:true,stdio:['ignore','pipe','pipe']});
 let output='';child.stdout.on('data',chunk=>{output=(output+chunk).slice(-4*1024*1024)});child.stderr.on('data',chunk=>{output=(output+chunk).slice(-4*1024*1024)});
 const closed=new Promise((resolve,reject)=>{child.once('error',reject);child.once('close',resolve)});
 return {child,closed,output:()=>output,async stop(){if(child.exitCode===null&&child.signalCode===null)globalThis.process.kill(-child.pid,'SIGTERM');await closed;}};
}

export async function ready(process,marker,timeout=180000) {
 const deadline=Date.now()+timeout;
 while(Date.now()<deadline){if(process.output().includes(marker))return;if(process.child.exitCode!==null||process.child.signalCode!==null)throw Error('Owned process stopped before '+marker+'; private output withheld.');await delay(250);}
 throw Error('Owned process readiness timeout at '+marker+'; private output withheld.');
}

export async function rerCommand(args,env=process.env) {
 const process=running(args,env),code=await process.closed;
 if(code!==0){let output=process.output();for(const value of Object.values(env))if(typeof value==='string'&&value.length>6)output=output.replaceAll(value,'[withheld]');output=output.replace(/https?:\/\/[^\s"<>]+/g,'[address withheld]');throw Error(`rer ${args[0]} failed (${code}): ${output.slice(-2400)}`);}
 return process.output();
}

export async function waitForFile(path,timeout=1800000) {
 const deadline=Date.now()+timeout;
 while(Date.now()<deadline){try{return await readFile(path,'utf8')}catch(error){if(error.code!=='ENOENT')throw error}await delay(1000);}
 throw Error('Fleet journey coordination timed out.');
}
