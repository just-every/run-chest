import { open, rename, rm } from 'node:fs/promises';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';

async function syncDirectory(file) {
  const fd = await open(dirname(file),'r');
  try { await fd.sync(); } finally { await fd.close(); }
}
export async function saveReceipt(file, receipt, initial = false) {
  const temporary = initial ? file : file + '.' + randomUUID() + '.tmp';
  const fd = await open(temporary,'wx',0o600);
  try { await fd.writeFile(JSON.stringify(receipt,null,2)+'\n'); await fd.sync(); }
  finally { await fd.close(); }
  if (!initial) {
    try { await rename(temporary,file); } finally { await rm(temporary,{force:true}); }
  }
  await syncDirectory(file);
}
