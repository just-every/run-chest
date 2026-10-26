import {localPortability} from '@runeditrun/rer/portability';
import {policy,transient} from './policy.mjs';

export function chestPortability() {
 const local=localPortability({database:'foundation',buckets:{originals:'BLOBS'},policy,transient});
 return {...local,remote:true,
  async import(context) {
   if(context.target!=='remote')return local.import(context);
   return (await import('./remote.mjs')).restoreRemote(context);
  },
 };
}
