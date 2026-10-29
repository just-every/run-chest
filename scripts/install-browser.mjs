// Install the pinned browser; avoid an unnecessary apt update when the runner already has its libraries.
import {spawnSync} from 'node:child_process';
import {mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {chromium} from '@playwright/test';
function install(...args){const result=spawnSync('pnpm',['exec','playwright',...args],{stdio:'inherit'});if(result.status!==0)throw Error('Playwright provisioning failed');}
async function probe(){const browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']});await browser.close();}
install('install','chromium');
try{await probe();}
catch(error){
 if(/EACCES|permission denied/i.test(String(error)))throw error;
 if(!/missing.*dependenc|error while loading shared libraries|cannot open shared object file/is.test(String(error)))throw error;
 if(process.platform==='linux'){
  const archives=join(process.env.RUNNER_TEMP??tmpdir(),'rer-apt','archives');
  await mkdir(archives,{recursive:true});
  const result=spawnSync('sudo',['env',`PATH=${process.env.PATH}`,`APT_ARCHIVES=${archives}`,'python3',process.argv[2]??'scripts/install-chromium-deps.py'],{stdio:'inherit'});
  if(result.error)throw result.error;
  if(result.status!==0)throw Error('Chromium system dependency provisioning failed');
 }else install('install-deps','chromium');
 await probe();
}
console.log('Pinned Chromium and its OS libraries are ready.');
