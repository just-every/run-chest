#!/usr/bin/env node
import {createHash,randomUUID} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {configuration,hostedEdge,createBackup,recoverBackup} from './hosted.mjs';
import {literal} from './database.mjs';
const settingsId='backup-settings:independent';
const objectId=value=>'backup-run:'+createHash('sha256').update(value).digest('hex');
export async function scheduledBackup(config,edge,{now=new Date(),backup=createBackup,verify=recoverBackup}={}){
 const stamp=now.toISOString(),rows=await edge.query("SELECT id,payload,revision FROM chest_records WHERE kind IN ('backup-settings','backup-run') ORDER BY json_extract(payload,'$.at') DESC"),settings=rows.find(r=>r.id===settingsId)
 if(!settings)return {state:'not_configured'}
 const s=JSON.parse(settings.payload);if(s.bucket!==config.bucket)throw Error('Independent bucket does not match the owner schedule.')
 await edge.query(`INSERT INTO chest_records(id,kind,payload,revision) VALUES('backup-contact:runner','backup-contact',${literal(JSON.stringify({at:stamp}))},${literal(randomUUID())}) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload,revision=excluded.revision`)
 const runs=rows.filter(r=>r.id!==settingsId),last=runs[0]&&JSON.parse(runs[0].payload)
 if(runs.some(r=>JSON.parse(r.payload).state==='running'))return {state:'running_requires_inspection'}
 const requested=s.requestedAt&&(!last||s.requestedAt>last.at),due=s.enabled&&(!last||now.getTime()-Date.parse(last.at)>=s.everyHours*3600000)
 if(!requested&&!due)return {state:s.enabled?'not_due':'paused'}
 const id=objectId(settings.revision+':'+(requested?s.requestedAt:last?.at??'first')),revision=randomUUID(),run={state:'running',at:stamp}
 await edge.query(`INSERT OR IGNORE INTO chest_records(id,kind,payload,revision) SELECT ${literal(id)},'backup-run',${literal(JSON.stringify(run))},${literal(revision)} WHERE EXISTS(SELECT 1 FROM chest_records WHERE id=${literal(settingsId)} AND revision=${literal(settings.revision)}) AND NOT EXISTS(SELECT 1 FROM chest_records WHERE kind='backup-run' AND json_extract(payload,'$.state')='running')`)
 const claimed=(await edge.query(`SELECT revision FROM chest_records WHERE id=${literal(id)}`))[0]
 if(claimed?.revision!==revision)return {state:'claimed_elsewhere'}
 let result
 try{const receipt=await backup(config,edge,{retentionDays:s.retentionDays});await verify(config,edge,{key:receipt.key});result={...run,...receipt,state:'complete',finishedAt:new Date().toISOString(),checkedAt:new Date().toISOString()}}
 catch{result={...run,state:'failed',finishedAt:new Date().toISOString(),error:'Independent backup failed; provider output withheld. Inspect private credentials, connectivity and archive integrity.'}}
 await edge.query(`UPDATE chest_records SET payload=${literal(JSON.stringify(result))},revision=${literal(randomUUID())} WHERE id=${literal(id)} AND revision=${literal(revision)}`)
 const saved=(await edge.query(`SELECT payload FROM chest_records WHERE id=${literal(id)}`))[0];if(JSON.parse(saved.payload).state!==result.state)return {id,state:'interrupted_by_owner'}
 await edge.query(`INSERT INTO chest_audit(id,actor,action,object_id,detail,at) VALUES(${literal(randomUUID())},'chest:backup-runner','backup.${result.state}',${literal(id)},${literal(JSON.stringify({outcome:result.state,bytes:result.bytes??0,objects:result.objects??0}))},${literal(result.finishedAt)})`)
 return {id,...result}
}
async function main(argv){
 const options={},watch=argv.includes('--watch'),args=argv.filter(a=>a!=='--watch');for(let i=0;i<args.length;i+=2){const field={'--environment':'environment','--env-file':'envFile'}[args[i]];if(!field||!args[i+1])throw Error('Usage: backup-schedule --environment NAME --env-file PRIVATE_FILE [--watch]');options[field]=args[i+1]}
 const config=configuration(options),edge=await hostedEdge(config)
 do{const result=await scheduledBackup(config,edge);console.log(JSON.stringify(result));if(!watch){if(result.state==='failed')process.exitCode=1;return}await new Promise(resolve=>setTimeout(resolve,60000))}while(true)
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)main(process.argv.slice(2)).catch(()=>{console.error('Backup runner stopped. Private provider details withheld. Check its configuration and restart it.');process.exitCode=1})
