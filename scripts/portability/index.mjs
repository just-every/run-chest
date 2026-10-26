import {localPortability} from '@runeditrun/rer/portability';
import {refuse} from '@runeditrun/rer/errors';
import {policy,transient} from './policy.mjs';

export function chestPortability() {
 const local=localPortability({database:'foundation',buckets:{originals:'BLOBS'},policy,transient});
 return {...local,remote:true,
  async export(context) {
   if(context.target!=='remote'){
    if(context.origin)throw refuse('Export with --origin requires explicit --target remote. No archive was written.');
    return local.export(context);
   }
   return (await import('./remote.mjs')).transferRemote(context,'export');
  },
  async import(context) {
   if(context.target!=='remote')return local.import(context);
   return (await import('./remote.mjs')).transferRemote(context,'import');
  },
 };
}
