import {createServer} from 'node:https';
import {once} from 'node:events';
import {Readable} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import {mkdir,writeFile} from 'node:fs/promises';
import {harness} from './harness.mjs';

// A transparent TLS boundary records only this journey's synthetic Office payloads.
export async function observedHost(options){
 let h,sequence=0;await mkdir('test-results',{recursive:true});
 const server=createServer(options.tls,async(request,response)=>{
  try{
   const chunks=[];for await(const chunk of request)chunks.push(chunk);const body=Buffer.concat(chunks),path=new URL(request.url,'https://127.0.0.1').pathname;
   const match=/^\/wopi\/files\/([a-f0-9-]+)\/contents$/.exec(path);
   if(match&&request.method==='POST')await writeFile(`test-results/wopi-${match[1]}-sent-${sequence++}.docx`,body);
   const result=await h.fetch(request.url,{method:request.method,headers:request.headers,...(['GET','HEAD'].includes(request.method)?{}:{body})});
   if(match&&request.method==='GET'&&result.status===200)await writeFile(`test-results/wopi-${match[1]}-read-${sequence++}.docx`,Buffer.from(await result.clone().arrayBuffer()));
   const headers=Object.fromEntries(result.headers);if(result.headers.getSetCookie().length)headers['set-cookie']=result.headers.getSetCookie();
   response.writeHead(result.status,headers);if(result.body)await pipeline(Readable.fromWeb(result.body),response);else response.end();
  }catch{response.writeHead(502);response.end('The test transport failed.')}
 });
 server.listen(0,'127.0.0.1');await once(server,'listening');
 const publicOrigin=`https://127.0.0.1:${server.address().port}`;
 try{h=await harness({...options,publicOrigin})}catch(error){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));throw error}
 const close=h.close;h.close=async()=>{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await close()};
 return h;
}
