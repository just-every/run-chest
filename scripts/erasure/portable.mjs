import { createReadStream } from 'node:fs';
import { Readable } from 'node:stream';
import { readArchive } from '@runeditrun/rer/modules/portability';
import { enforceJournal, ErasureFenceError } from './journal.mjs';

// Consume through closing: readArchive verifies every part, original and the
// complete manifest binding before this preflight can authorize a restore.
export async function checkPortableJournal(input, journal) {
  let manifest, databaseSource;
  const entries = [];
  for await (const record of readArchive(Readable.toWeb(createReadStream(input)))) {
    if (record.kind === 'manifest') manifest = record;
    if (record.kind !== 'part') continue;
    for (const item of record.items) {
      if (item.kind !== 'row') continue;
      if (item.table === 'rer_portability_state' && item.row.id === 1) databaseSource = item.row.source_identity;
      if (item.table === 'chest_records' && item.row.kind === 'erasure-journal') entries.push(JSON.parse(item.row.payload));
    }
  }
  if (databaseSource && databaseSource !== manifest.sourceIdentity) throw new ErasureFenceError('Archive source identities disagree. Nothing was restored.');
  enforceJournal(journal, manifest.sourceIdentity, entries);
  return { source: manifest.sourceIdentity, originals: manifest.objects.length, erasures: entries.length };
}
