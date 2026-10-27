// Refresh one clause's status projections without rewriting other builders' rows.
import {readFileSync,writeFileSync} from 'node:fs';
import {parseContract} from '../src/base/seed-contract.mjs';
const [mode,id]=process.argv.slice(2);
if(!['write','check'].includes(mode)||!id)throw Error('Usage: node scripts/contract-docs.mjs write|check <clause>');
const source=readFileSync('CONTRACT.md','utf8'),contract=parseContract(source),clause=contract.clauses.find(c=>c.id===id);
if(!clause)throw Error('Unknown clause');
const row=source.split('\n')[clause.row-1].split('|').slice(1,-1).map(c=>c.trim());
const evidence=row[4],gap=row[5];
const acceptance=readFileSync('ACCEPTANCE.md','utf8');
const start=acceptance.indexOf(`**${id} — `),end=acceptance.indexOf('\n**',start+2);
if(start<0)throw Error('Missing acceptance section');
const section=acceptance.slice(start,end<0?undefined:end);
const projected=section.replace(/\((?:done|partial|missing)\)\.\*\*/,`(${clause.status}).**`).replace(/Current evidence:[^\n]*/,`Current evidence: ${evidence}.${gap?` Remaining: ${gap}`:''}`);
if(projected===section&&!section.includes(`Current evidence: ${evidence}.`))throw Error('Missing evidence projection');
const nextAcceptance=acceptance.slice(0,start)+projected+(end<0?'':acceptance.slice(end));
const claims=readFileSync('docs/CLAIMS.md','utf8');
const nextClaims=claims.split('\n').map(line=>{
 if(!line.startsWith('| '))return line;
 const cells=line.split('|').slice(1,-1).map(c=>c.trim());
 if(cells.length!==6||!new RegExp(`\\b${id}\\b`).test(cells[4]))return line;
 const ids=[...cells[4].matchAll(/([A-Z][A-Z0-9-]*-\d{2,3}) \((?:done|partial|missing)\)/g)].map(m=>m[1]);
 const clauses=ids.map(key=>contract.clauses.find(c=>c.id===key));
 if(clauses.some(c=>!c))throw Error('Unknown homepage clause');
 cells[3]=clauses.every(c=>c.status==='done')?'code':clauses.some(c=>c.status!=='missing')?'partly':'contract, not yet in code';
 cells[4]=clauses.map(c=>`${c.id} (${c.status})`).join(', ');
 cells[5]=[...new Set(clauses.flatMap(c=>c.evidence))].map(path=>'`'+path+'`').join('; ');
 return '| '+cells.join(' | ')+' |';
}).join('\n');
for(const [path,before,after] of [['ACCEPTANCE.md',acceptance,nextAcceptance],['docs/CLAIMS.md',claims,nextClaims]]){
 if(mode==='write')writeFileSync(path,after);
 else if(before!==after)throw Error(`Stale clause projection: ${path}`);
}
console.log(`Contract projections ${mode}: ${id}`);
