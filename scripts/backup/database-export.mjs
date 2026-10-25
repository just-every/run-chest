// D1's polling export protocol, followed by its private signed download.
import {createWriteStream} from 'node:fs';
import {Readable} from 'node:stream';
import {pipeline} from 'node:stream/promises';
export async function exportDatabase(creds, database, output, transport, noSchema=false) {
 let bookmark;
 for(let attempt=0;attempt<120;attempt++){
  const response=await transport(`https://api.cloudflare.com/client/v4/accounts/${creds.account}/d1/database/${database}/export`,{method:'POST',redirect:'error',signal:AbortSignal.timeout(30000),headers:{authorization:`Bearer ${creds.token}`,'content-type':'application/json'},body:JSON.stringify({output_format:'polling',dump_options:{no_schema:noSchema,no_data:false,tables:[]},...(bookmark?{current_bookmark:bookmark}:{})})});
  const data=await response.json().catch(()=>null),result=data?.result;
  if(!response.ok||data?.success===false||!result?.success||result.status==='error')throw Error('Database export was refused; private provider details withheld.');
  if(result.status==='complete'){
   let url;try{url=new URL(result.result?.signed_url)}catch{throw Error('Database export did not supply a download.');}
   if(url.protocol!=='https:'||url.username||url.password)throw Error('Database export supplied an unsafe download.');
   const download=await transport(url.href,{method:'GET',redirect:'error',signal:AbortSignal.timeout(600000)});
   if(!download.ok||!download.body){await download.body?.cancel();throw Error('Database export download failed; private provider details withheld.');}
   await pipeline(Readable.fromWeb(download.body),createWriteStream(output,{mode:0o600}));return;
  }
  if(typeof result.at_bookmark!=='string'||!result.at_bookmark)throw Error('Database export returned no polling bookmark.');
  bookmark=result.at_bookmark;await new Promise(resolve=>setTimeout(resolve,1000));
 }
 throw Error('Database export did not complete within the polling budget.');
}
