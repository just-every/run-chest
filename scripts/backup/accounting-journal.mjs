// Private metadata journal survives database replacement and interrupted commands.
import {DatabaseSync} from 'node:sqlite';
import {mkdirSync,chmodSync,lstatSync,existsSync,openSync,writeFileSync,readFileSync,closeSync,unlinkSync} from 'node:fs';
import {homedir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {providerTransport} from './accounting.mjs';
export async function accountingJournal(query,identity,producer) {
 const directory=process.env.CHEST_ACCOUNTING_DIR??join(homedir(),'.rer','chest-accounting');mkdirSync(directory,{recursive:true,mode:0o700});
 const directoryInfo=lstatSync(directory);if(!directoryInfo.isDirectory()||directoryInfo.isSymbolicLink()||typeof process.getuid==='function'&&directoryInfo.uid!==process.getuid())throw Error('Accounting journal requires an owned private directory.');chmodSync(directory,0o700);
 const path=join(directory,createHash('sha256').update(identity).digest('hex')+'.sqlite');
 if(existsSync(path)&&(!lstatSync(path).isFile()||lstatSync(path).isSymbolicLink()||typeof process.getuid==='function'&&lstatSync(path).uid!==process.getuid()||(lstatSync(path).mode&0o077)!==0))throw Error('Accounting journal requires a private regular file.');
 // Serialize commands for this target without holding an uncommitted SQLite transaction.
 // SQLite checkpoints stay durable even if the command is interrupted.
 const lock=path+'.lock';
 function claim(){const fd=openSync(lock,'wx',0o600);try{writeFileSync(fd,String(process.pid))}finally{closeSync(fd)}}
 try{claim()}catch(error){
  if(error.code!=='EEXIST')throw error;
  const info=lstatSync(lock);if(!info.isFile()||info.isSymbolicLink()||typeof process.getuid==='function'&&info.uid!==process.getuid())throw Error('Accounting command lock needs owner inspection.');
  const owner=Number(readFileSync(lock,'utf8'));if(!Number.isSafeInteger(owner)||owner<1)throw Error('Accounting command lock needs owner inspection.');
  try{process.kill(owner,0);throw Error('Another portability command owns this target; retry after it finishes.')}catch(error){if(error.code!=='ESRCH')throw error}
  // Exclusive creation still rejects another command that recovered the stale owner first.
  unlinkSync(lock);claim();
 }
 let db;try{db=new DatabaseSync(path);chmodSync(path,0o600)}catch(error){unlinkSync(lock);throw error}

 db.exec('CREATE TABLE IF NOT EXISTS chest_audit(id TEXT PRIMARY KEY,actor TEXT,action TEXT,object_id TEXT,detail TEXT,at TEXT);');
 const local=async sql=>{const stmt=db.prepare(sql);return stmt.columns().length?stmt.all():(stmt.run(),[])};
 const quote=v=>"'"+String(v).replaceAll("'","''")+"'";
 return {
  transport:provider=>async(url,init)=>{
   const rates=await query("SELECT payload FROM chest_records WHERE id='admin-cost-rates' AND kind='admin-cost-rates'");
   const snapshot=sql=>sql.startsWith('SELECT payload FROM chest_records')?Promise.resolve(rates):local(sql);
   return providerTransport(snapshot,provider,producer)(url,init);
  },
  async flush(){
   for(const row of db.prepare('SELECT * FROM chest_audit').all()){
    // Lost completions remain uncertain; never infer a successful transfer.
    const detail=JSON.parse(row.detail);if(detail.outcome==='running'){detail.outcome='uncertain';row.detail=JSON.stringify(detail)}
    await query('INSERT INTO chest_audit VALUES('+[row.id,row.actor,row.action,row.object_id,row.detail,row.at].map(quote).join(',')+') ON CONFLICT(id) DO UPDATE SET detail=excluded.detail');
    db.prepare('DELETE FROM chest_audit WHERE id=?').run(row.id);
   }
  },
  close(){db.close();unlinkSync(lock)},
 };
}
