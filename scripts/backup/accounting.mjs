// Durable metadata only. Neither object keys nor signed requests enter accounting.
import {randomUUID} from 'node:crypto';
const literal=value=>"'"+String(value).replaceAll("'","''")+"'";
export function providerTransport(query, provider) {
 return async (url, init) => {
  const saved=(await query("SELECT payload FROM chest_records WHERE id='admin-cost-rates' AND kind='admin-cost-rates'"))[0];
  const rates=saved?JSON.parse(saved.payload):null,rate=rates?.aiProvider===provider&&rates.aiModel==='request'?rates:null;
  const id=randomUUID(),startedAt=new Date().toISOString(),requestBytes=init.body?Buffer.byteLength(init.body):0;
  const detail={provider,model:'request',producer:'independent backup',startedAt,requestBytes,responseBytes:0,reservedResponseBytes:0,requestOutcome:'uncertain',outcome:'running',quote:rate?.quote??null,rateAt:rate?.updatedAt??null,requestUsd:rate?.aiRequestUsd??null,usd:null,networkProvider:rates?.provider??null,networkQuote:rates?.quote??null,networkRateAt:rates?.updatedAt??null,networkUsd:rates?Number((requestBytes/1e9*rates.egressUsdPerGb).toFixed(9)):null};
  await query(`INSERT INTO chest_audit VALUES(${literal(id)},'chest:backup','provider.usage','administration',${literal(JSON.stringify(detail))},${literal(startedAt)})`);
  async function persist(extra={}){Object.assign(detail,extra,{checkpointAt:new Date().toISOString()});await query(`UPDATE chest_audit SET detail=${literal(JSON.stringify(detail))} WHERE id=${literal(id)}`)}
  let response;
  try{response=await fetch(url,init);await persist({status:response.status,requestOutcome:'provider responded',usd:rate?.aiRequestUsd??null});}
  catch(error){await persist({outcome:'uncertain'});throw error}
  const outcome=response.ok?'succeeded':'refused',reader=response.body?.getReader();
  if(!reader){await persist({outcome});return response}
  const stream=new ReadableStream({
   async pull(controller){try{const part=await reader.read();if(part.done){await persist({outcome});controller.close();return}await persist({reservedResponseBytes:detail.responseBytes+part.value.byteLength});controller.enqueue(part.value);await persist({responseBytes:detail.reservedResponseBytes});}catch(error){await persist({outcome:'uncertain'});controller.error(error);await reader.cancel().catch(()=>{})}},
   async cancel(){try{await reader.cancel()}finally{await persist({outcome:'cancelled'})}},
  },{highWaterMark:0});
  return new Response(stream,{status:response.status,statusText:response.statusText,headers:response.headers});
 };
}
