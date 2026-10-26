import {createHash} from 'node:crypto';
import {activeWorker} from '@runeditrun/rer/internal/modules/deploy-kit/worker.mjs';
import {sameDeployment,checkResourceIdentity} from '@runeditrun/rer/internal/modules/deploy-kit/owner.mjs';
import {s3} from '../hosted/s3.mjs';
import {objectBinding} from './remote-objects.mjs';

export async function remoteBindings({state,signal}) {
 const account=process.env.CLOUDFLARE_ACCOUNT_ID,token=process.env.CLOUDFLARE_API_TOKEN;
 if(!account||!token||account!==state.accountId)throw Error('Hosted restore needs the recorded deploying account and token.');
 async function request(path,{method='GET',body}={}) {
  let response;
  try {response=await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}${path}`,{
   method,headers:{authorization:`Bearer ${token}`,'content-type':'application/json'},
   ...(body===undefined?{}:{body:JSON.stringify(body)}),signal:signal?AbortSignal.any([signal,AbortSignal.timeout(60000)]):AbortSignal.timeout(60000),redirect:'error'});}catch{throw Error('Hosted restore provider connection failed.');}
  const data=await response.json().catch(()=>null);
  if(!response.ok||data?.success!==true||!Object.hasOwn(data,'result'))throw Error(`Hosted restore provider refused (${response.status}).`);
  return data.result;
 }
 const api={request};
 const databaseName=state.worker+'-db',bucketName=state.worker+'-blobs';
 const database=state.owned.d1[databaseName],bucket=state.owned.r2[bucketName];
 if(database?.status!=='created'||bucket?.status!=='created')throw Error('Hosted restore requires resources created by this deployment.');
 async function owned() {
  const live=await activeWorker(api,state.worker);
  if(!live||!sameDeployment(live,state.receipt.provider))throw Error('Hosted restore refused a changed deployment.');
  checkResourceIdentity('d1',databaseName,await request('/d1/database/'+database.id),database);
  checkResourceIdentity('r2',bucketName,await request('/r2/buckets/'+bucketName),bucket);
  if(!live.settings.bindings.some(binding=>binding.name==='DB'&&binding.type==='d1'&&binding.id===database.id)
   ||!live.settings.bindings.some(binding=>binding.name==='BLOBS'&&binding.type==='r2_bucket'&&binding.bucket_name===bucketName))throw Error('Hosted restore binding mismatch.');
 }
 await owned();
 async function execute(body) {
  const rows=await request(`/d1/database/${database.id}/query`,{method:'POST',body});
  if(!Array.isArray(rows)||rows.some(row=>row.success!==true||!Array.isArray(row.results)))throw Error('Hosted restore database transaction failed.');
  return rows;
 }
 const prepare=(sql,params=[])=>({sql,params,bind(...values){return prepare(sql,values)},
  async all(){return (await execute({sql,params}))[0]},async run(){return this.all()},
  async first(column){const row=(await this.all()).results[0]??null;return column&&row?row[column]:row},
 });
 const db={prepare,batch:statements=>statements.length?execute({batch:statements.map(({sql,params})=>({sql,params}))}):Promise.resolve([])};
 let verification;
 try {const response=await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}/tokens/verify`,{headers:{authorization:`Bearer ${token}`},redirect:'error'});verification=await response.json();}catch{throw Error('Hosted restore could not verify object-store authority.');}
 if(verification?.success!==true||!verification.result?.id)throw Error('Hosted restore could not verify object-store authority.');
 const client=s3({endpoint:`https://${account}.r2.cloudflarestorage.com`,region:'auto',accessKeyId:verification.result.id,secretAccessKey:createHash('sha256').update(token).digest('hex')},bucketName);
 return {db,bucket:objectBinding(client),owned};
}
