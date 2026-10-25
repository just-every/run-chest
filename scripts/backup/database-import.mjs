// D1's file-import protocol; private URLs and SQL never enter receipts or errors.
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
export async function importDatabase(creds,database,file,transport){
 const bytes=await readFile(file),etag=createHash('md5').update(bytes).digest('hex');
 const endpoint=`https://api.cloudflare.com/client/v4/accounts/${creds.account}/d1/database/${database}/import`;
 async function call(body){
  const response=await transport(endpoint,{method:'POST',redirect:'error',signal:AbortSignal.timeout(60000),headers:{authorization:`Bearer ${creds.token}`,'content-type':'application/json'},body:JSON.stringify(body)});
  const data=await response.json().catch(()=>null);if(!response.ok||data?.success===false||!data?.result)throw Error('Database import was refused; provider details withheld.');return data.result;
 }
 let result=await call({action:'init',etag});
 if(result.upload_url){
  let url;try{url=new URL(result.upload_url)}catch{throw Error('Database import supplied no safe upload.');}
  if(url.protocol!=='https:'||url.username||url.password)throw Error('Database import supplied an unsafe upload.');
  const response=await transport(url.href,{method:'PUT',redirect:'error',signal:AbortSignal.timeout(600000),headers:{'content-length':String(bytes.length)},body:bytes});await response.arrayBuffer();
  if(response.status!==200||response.headers.get('etag')?.replace(/^"|"$/g,'')!==etag)throw Error('Database import upload did not verify.');
  if(typeof result.filename!=='string'||!result.filename)throw Error('Database import supplied no file reference.');
  result=await call({action:'ingest',filename:result.filename,etag});
 }
 for(let attempt=0;attempt<120;attempt++){
  if(!result.success||result.status==='error')throw Error('Database import did not complete; provider details withheld.');
  if(result.status==='complete')return;
  if(typeof result.at_bookmark!=='string'||!result.at_bookmark)throw Error('Database import supplied no polling bookmark.');
  await new Promise(resolve=>setTimeout(resolve,1000));result=await call({action:'poll',current_bookmark:result.at_bookmark});
 }
 throw Error('Database import exceeded its polling budget.');
}
