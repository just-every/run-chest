import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {createRequire} from 'node:module';
import {createPortability,PortabilityError} from '@runeditrun/rer/modules/portability';
import {fileRecords,importArchive,exportArchive} from '@runeditrun/rer/internal/modules/portability/files.mjs';
import {appliedMigrations} from '@runeditrun/rer/portability-migrations';
import {migrationReplay} from '@runeditrun/rer/internal/modules/portability/migration-history.mjs';
import {ensurePortabilitySchema,portabilityPlan} from '@runeditrun/rer/internal/modules/container/portability-schema.mjs';
import {RerError,refuse,missing} from '@runeditrun/rer/errors';
import {remoteBindings} from './remote-bindings.mjs';
import {withStateLock} from '@runeditrun/rer/internal/modules/deploy-kit/owner.mjs';
import {policy,transient} from './policy.mjs';

// The provider token authorizes this offline restore. No new web endpoint or
// session authority is introduced. An exact recorded deployment is required.
export async function transferRemote({root,path,origin,store,signal},direction) {
 if(!origin)throw missing('Hosted restore requires --origin with the exact deployed HTTPS address.');
 const url=new URL(origin);
 if(url.protocol!=='https:'||url.origin!==origin||url.username||url.password)throw refuse('Use the exact HTTPS deployment origin without a path.');
 if(direction==='import')for await(const record of fileRecords(path)){}
 const records=[];
 const {readdir}=await import('node:fs/promises');
 for(const file of await readdir(join(root,'.rer/deploy')).catch(()=>[])) {
  if(!file.endsWith('.json'))continue;
  const state=JSON.parse(await readFile(join(root,'.rer/deploy',file),'utf8'));
  if(state.receipt?.origin===origin)records.push({state,environment:file.slice(0,-5)});
 }
 if(records.length!==1)throw refuse('Hosted restore requires one matching local deployment record. Deploy this release first.');
 const {state,environment}=records[0];
 if(state.pendingUpload||state.pendingSecret)throw refuse('Finish the pending deployment before restoring.');
 return withStateLock(join(root,'.rer/deploy',environment+'.json'),async()=>{
 const bindings=await remoteBindings({root,state,environment,origin,signal});
 try {
  const {unstable_splitSqlQuery:split}=createRequire(join(root,'package.json'))('wrangler');
  await ensurePortabilitySchema(bindings.db,await portabilityPlan(split));
  const migrations=async()=>migrationReplay(await appliedMigrations(root,bindings.db,'DB',{},split),policy);
  const service=await createPortability({db:bindings.db,buckets:{originals:bindings.bucket},policy,migrations});
  store.report(direction==='import'?'Checking and restoring the archive into the recorded empty hosted installation.':'Exporting all portable records and original bytes from the recorded hosted installation.');
  const receipt=await (direction==='import'?importArchive:exportArchive)(service,path,transient);
  await bindings.owned();
  store.report(direction==='import'?'Restored portable records and verified original bytes. Sign in again by email.':'Exported portable records and verified original bytes.');
  return {target:'remote',[direction==='import'?'input':'output']:path,...receipt};
 }catch(error) {
  if(error instanceof PortabilityError)throw new RerError('restore_refused',`Hosted restore refused (${error.code.split(':')[0]}). The original installation and archive are retained.`,4);
  throw error;
 }
 });
}
