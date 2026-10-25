// Durable metadata only. Neither object keys nor signed requests enter accounting.
import {randomUUID} from 'node:crypto';
const literal=value=>"'"+String(value).replaceAll("'","''")+"'";
export function operationFor(url,method='GET') {
 const u=new URL(url);
 if(u.pathname.endsWith('/export'))return 'database-export';
 if(!u.hostname.endsWith('.r2.cloudflarestorage.com')&&!u.searchParams.has('list-type')&&!/s3/.test(u.hostname)&&u.pathname.endsWith('/download'))return 'database-download';
 if(u.searchParams.has('list-type'))return 'list';
 if(u.searchParams.has('uploads'))return 'multipart-start';
 if(u.searchParams.has('uploadId'))return method==='PUT'?'multipart-part':method==='DELETE'?'multipart-abort':'multipart-complete';
 return ({GET:'read',PUT:'write',DELETE:'delete'})[method]??'unknown';
}
export function providerTransport(query, provider, producer='independent backup') {
 return async (url, init) => {
  const saved=(await query("SELECT payload FROM chest_records WHERE id='admin-cost-rates' AND kind='admin-cost-rates'"))[0];
  const rates=saved?JSON.parse(saved.payload):null,rate=rates?.aiProvider===provider&&rates.aiModel==='request'?rates:null;
  const operation=provider==='Cloudflare D1'?(new URL(url).pathname.endsWith('/export')?'database-export':new URL(url).pathname.endsWith('/import')?'database-import':new URL(url).pathname.endsWith('/query')?'database-query':init.method==='PUT'?'database-upload':'database-download'):operationFor(url,init.method);
  const objectRate=rates?.objectProvider===provider?rates:null,operationRate=objectRate?.objectOperations?.[operation];
  const id=randomUUID(),startedAt=new Date().toISOString(),requestBytes=init.body?Buffer.byteLength(init.body):0;
  const detail={provider,model:'request',producer,operation,operationUsdPerMillion:operationRate??null,inboundUsdPerGb:objectRate?.objectInboundUsdPerGb??null,outboundUsdPerGb:objectRate?.objectOutboundUsdPerGb??null,inboundUsd:null,outboundUsd:null,startedAt,requestBytes,responseBytes:0,reservedResponseBytes:0,requestOutcome:'uncertain',outcome:'running',quote:(objectRate??rate)?.quote??null,rateAt:(objectRate??rate)?.updatedAt??null,requestUsd:rate?.aiRequestUsd??null,usd:null,networkProvider:rates?.provider??null,networkQuote:rates?.quote??null,networkRateAt:rates?.updatedAt??null,networkUsd:rates?Number((requestBytes/1e9*rates.egressUsdPerGb).toFixed(9)):null};
  await query(`INSERT INTO chest_audit VALUES(${literal(id)},'chest:backup','provider.usage','administration',${literal(JSON.stringify(detail))},${literal(startedAt)})`);
  let writes=Promise.resolve();
  function persist(extra={}){Object.assign(detail,extra,{checkpointAt:new Date().toISOString()});
   detail.inboundUsd=objectRate?Number((requestBytes/1e9*objectRate.objectInboundUsdPerGb).toFixed(9)):null;
   detail.outboundUsd=objectRate?Number((detail.responseBytes/1e9*objectRate.objectOutboundUsdPerGb).toFixed(9)):null;
   if(objectRate)detail.usd=operationRate===undefined||detail.requestOutcome==='uncertain'?null:Number((operationRate/1e6+detail.inboundUsd+detail.outboundUsd).toFixed(9));const encoded=JSON.stringify(detail);const pending=writes.then(()=>query(`UPDATE chest_audit SET detail=${literal(encoded)} WHERE id=${literal(id)}`));writes=pending.catch(()=>{});return pending}
  let response;
  try{response=await fetch(url,init);await persist({status:response.status,requestOutcome:'provider responded',usd:rate?.aiRequestUsd??null});}
  catch(error){await persist({outcome:'uncertain'});throw error}
  const outcome=response.ok?'succeeded':'refused',reader=response.body?.getReader();
  if(!reader){await persist({outcome});return response}
  const stream=new ReadableStream({
   async pull(controller){try{const part=await reader.read();if(part.done){await persist({outcome});controller.close();return}await persist({reservedResponseBytes:detail.responseBytes+part.value.byteLength});controller.enqueue(part.value);await persist({responseBytes:detail.reservedResponseBytes});}catch(error){await persist({outcome:'uncertain'});controller.error(error);await reader.cancel().catch(()=>{})}},
   async cancel(){try{await reader.cancel()}finally{await persist({outcome:response.ok?'cancelled':'refused'})}},
  },{highWaterMark:0});
  return new Response(stream,{status:response.status,statusText:response.statusText,headers:response.headers});
 };
}
