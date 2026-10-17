// Exercise the real Auth seed's built Worker, on its own listener and D1 database.
// Only mail delivery crosses a test-controlled network edge. No identity protocol is simulated.
import {createRequire} from 'node:module';
import {randomBytes} from 'node:crypto';
import {mkdtemp,readdir,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {createServer} from 'node:net';
import {request as httpsRequest} from 'node:https';
import {createServer as httpServer} from 'node:http';
const require=createRequire(import.meta.url);
const {unstable_getMiniflareWorkerOptions:workerOptions,unstable_splitSqlQuery:splitSql}=require('wrangler');
const {Miniflare,convertV4MiniflareOptions}=createRequire(require.resolve('wrangler'))('miniflare');
export async function authProvider({checkout,mailEdge,owner='erin@example.test',apiKey='test-only-sendgrid-edge',mailFrom='Chest <auth@example.test>'}) {
 const directory=await mkdtemp(join(tmpdir(),'chest-auth-provider-')),socket=createServer();await new Promise(r=>socket.listen(0,'127.0.0.1',r));const port=socket.address().port;await new Promise(r=>socket.close(r));
 const origin=`https://localhost:${port}`,root=resolve(checkout,'dist/server'),secret=()=>randomBytes(32).toString('base64url');
 const vars={AUTH_LOCAL:'true',AUTH_ORIGIN:origin,OWNER_EMAIL:owner,SESSION_SECRET:secret(),SETUP_TOKEN:secret(),AUTH_ENCRYPTION_KEY:secret(),MAIL_PROVIDER:'sendgrid',MAIL_API_KEY:apiKey,MAIL_FROM:mailFrom};
 const {compatibilityDate,compatibilityFlags,assets,d1Databases}=workerOptions(join(root,'wrangler.json')).workerOptions;
 const modules=['index.js',...(await readdir(join(root,'assets'))).map(f=>'assets/'+f)].map(f=>({type:'ESModule',path:join(root,f)}));
 const worker=new Miniflare({...convertV4MiniflareOptions({host:'127.0.0.1',port,https:true,modulesRoot:root,modules,compatibilityDate,compatibilityFlags,assets,d1Databases,bindings:vars,...(mailEdge?{outboundService:mailEdge}:{})}),resourcePersistencePath:directory});
 try {await worker.ready;const db=await worker.getD1Database('DB');for(const file of (await readdir(join(checkout,'migrations/core'))).filter(f=>f.endsWith('.sql')).sort())for(const statement of splitSql(await readFile(join(checkout,'migrations/core',file),'utf8')))await db.prepare(statement).run()}catch(e){await worker.dispose();await rm(directory,{recursive:true,force:true});throw e}
 const fetch=async(input,init={})=>{const url=typeof input==='string'?input:input.url,method=init.method||input.method||'GET',headers=init.headers||Object.fromEntries(input.headers||[]),body=init.body??(typeof input!=='string'&&!['GET','HEAD'].includes(method)?Buffer.from(await input.arrayBuffer()):undefined);return new Promise((resolve,reject)=>{const r=httpsRequest(url,{method,headers,rejectUnauthorized:false},res=>{const chunks=[];res.on('data',d=>chunks.push(d));res.on('end',()=>resolve(new Response(Buffer.concat(chunks),{status:res.statusCode,headers:res.headers})))});r.on('error',reject);r.end(body)})};
 const post=(path,data,cookie)=>fetch(origin+path,{method:'POST',headers:{origin,'content-type':'application/json',...(cookie?{cookie}:{})},body:JSON.stringify(data)});
 const claim=await post('/auth/bootstrap',{token:vars.SETUP_TOKEN,displayName:'Erin Chen'});if(claim.status!==303){const detail=await claim.text();await worker.dispose();await rm(directory,{recursive:true,force:true});throw Error(`Auth owner bootstrap refused: ${claim.status} ${detail}`);}
 return {origin,vars,worker,post,fetch,async ageKeys(){const db=await worker.getD1Database('DB');await db.prepare('UPDATE auth_signing_keys SET published_at=?,use_after=?').bind(Date.now()-360_000,Date.now()-60_000).run()},async close(){await worker.dispose();await rm(directory,{recursive:true,force:true})}};
}

// Auth permits HTTP loopback SCIM connectors. This local transport forwards to the
// same real HTTPS Worker used by browser callbacks; the SCIM implementation stays unchanged.
export async function scimTransport(h) {
 const server=httpServer(async(req,res)=>{try{const chunks=[];for await(const chunk of req)chunks.push(chunk);const response=await h.fetch(req.url,{method:req.method,headers:req.headers,...(!['GET','HEAD'].includes(req.method)?{body:Buffer.concat(chunks)}:{})});res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()))}catch{res.writeHead(502);res.end()}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 return {origin:`http://127.0.0.1:${server.address().port}`,close:()=>new Promise(resolve=>server.close(resolve))};
}
