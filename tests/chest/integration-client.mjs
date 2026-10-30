// A genuine third-party HTTPS attachment app. Its only Chest behavior is the public component.
import {createServer} from 'node:https';
import {execFileSync} from 'node:child_process';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
export async function attachmentClient(chestOrigin){
 const directory=await mkdtemp(join(tmpdir(),'chest-partner-')),key=join(directory,'key.pem'),cert=join(directory,'cert.pem'),apps=new Map();
 execFileSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-subj','/CN=picker-client.example.test','-days','1','-keyout',key,'-out',cert],{stdio:'ignore'});
 let origin;
 const server=createServer({key:await readFile(key),cert:await readFile(cert)},(request,response)=>{
  const url=new URL(request.url,origin),id=url.pathname.split('/').at(-1),options=apps.get(id);if(!options){response.writeHead(404);response.end();return}
  const callback=url.pathname.startsWith('/callback/');response.writeHead(200,{'content-type':'text/html'});
  response.end(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Partner attachments</title><style>body{font:16px system-ui;margin:24px}#result{overflow-wrap:anywhere}</style><script src="${chestOrigin}/chest-picker.js"></script></head><body>${callback?'<p>Returning authorization to the partner app…</p>':`<h1>Partner attachments</h1><button id="attach">Attach from Chest</button><p id="result" role="status"></p><script>window.picker=new ChestPicker(${JSON.stringify(options)});document.querySelector('#attach').onclick=async()=>{try{const item=await picker.pick();document.querySelector('#result').textContent=JSON.stringify(item)}catch(error){document.querySelector('#result').textContent=error.message;document.querySelector('#result').dataset.error=error.code||''}};</script>`}</body></html>`)
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));origin=`https://picker-client.example.test:${server.address().port}`;
 return {origin,add(id,clientId,resources,actions=['read','search','picker','webhook']){apps.set(String(id),{chestOrigin,clientId,redirectUri:`${origin}/callback/${id}`,resources,actions})},async close(){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await rm(directory,{recursive:true,force:true})}}
}
