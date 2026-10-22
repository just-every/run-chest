// Install the pinned browser; avoid an unnecessary apt update when the runner already has its libraries.
import {spawnSync} from 'node:child_process';
import {chromium} from '@playwright/test';
function install(...args){const result=spawnSync('pnpm',['exec','playwright',...args],{stdio:'inherit'});if(result.status!==0)throw Error('Playwright provisioning failed');}
async function probe(){const browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']});await browser.close();}
install('install','chromium');
try{await probe();}
catch(error){
 if(!/missing.*dependenc|error while loading shared libraries|cannot open shared object file/is.test(String(error)))throw error;
 install('install-deps','chromium');
 await probe();
}
console.log('Pinned Chromium and its OS libraries are ready.');
