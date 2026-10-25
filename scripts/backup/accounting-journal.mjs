// Private metadata journal survives database replacement and interrupted commands.
import {DatabaseSync} from 'node:sqlite';
import {mkdirSync,chmodSync,lstatSync,existsSync} from 'node:fs';
import {homedir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {providerTransport} from './accounting.mjs';
export async function accountingJournal(query,identity,producer) {
 const directory=process.env.CHEST_ACCOUNTING_DIR??join(homedir(),'.rer','chest-accounting');mkdirSync(directory,{recursive:true,mode:0o700});
 const directoryInfo=lstatSync(directory);if(!directoryInfo.isDirectory()||directoryInfo.isSymbolicLink()||typeof process.getuid==='function'&&directoryInfo.uid!==process.getuid())throw Error('Accounting journal requires an owned private directory.');chmodSync(directory,0o700);
 const path=join(directory,createHash('sha256').update(identity).digest('hex')+'.sqlite');
 if(existsSync(path)&&(!lstatSync(path).isFile()||lstatSync(path).isSymbolicLink()||typeof process.getuid==='function'&&lstatSync(path).uid!==process.getuid()||(lstatSync(path).mode&0o077)!==0))throw Error('Accounting journal requires a private regular file.');
 const db=new DatabaseSync(path);chmodSync(path,0o600);
 db.exec('CREATE TABLE IF NOT EXISTS chest_records(id TEXT PRIMARY KEY,kind TEXT,payload TEXT); CREATE TABLE IF NOT EXISTS chest_audit(id TEXT PRIMARY KEY,actor TEXT,action TEXT,object_id TEXT,detail TEXT,at TEXT);');
 const local=async sql=>{const stmt=db.prepare(sql);return stmt.columns().length?stmt.all():(stmt.run(),[])};
 const quote=v=>"'"+String(v).replaceAll("'","''")+"'";
 return {
  transport:provider=>async(url,init)=>{
   const rates=await query("SELECT payload FROM chest_records WHERE id='admin-cost-rates' AND kind='admin-cost-rates'");
   db.prepare('DELETE FROM chest_records').run();if(rates[0])db.prepare('INSERT INTO chest_records VALUES(?,?,?)').run('admin-cost-rates','admin-cost-rates',rates[0].payload);
   return providerTransport(local,provider,producer)(url,init);
  },
  async flush(){
   for(const row of db.prepare('SELECT * FROM chest_audit').all()){
    // Lost completions remain uncertain; never infer a successful transfer.
    const detail=JSON.parse(row.detail);if(detail.outcome==='running'){detail.outcome='uncertain';row.detail=JSON.stringify(detail)}
    await query('INSERT INTO chest_audit VALUES('+[row.id,row.actor,row.action,row.object_id,row.detail,row.at].map(quote).join(',')+') ON CONFLICT(id) DO UPDATE SET detail=excluded.detail');
    db.prepare('DELETE FROM chest_audit WHERE id=?').run(row.id);
   }
  },
  close(){db.prepare('DELETE FROM chest_records').run();db.close()},
 };
}
