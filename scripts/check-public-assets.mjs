import { readdir, lstat } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { Readable } from 'node:stream';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { archiveLines } from '@runeditrun/rer/internal/modules/portability/lines.mjs';
import { FORMAT, MAX_LINE_BYTES } from '@runeditrun/rer/modules/portability/format';

async function hasArchiveManifest(file) {
  // Match the importer's UTF-8 framing and line bound, including JSON escapes,
  // whitespace and property order. Never depend on a filename or byte prefix.
  const lines = archiveLines(Readable.toWeb(createReadStream(file)), MAX_LINE_BYTES);
  try {
    const first = await lines.next();
    if (first.done) return false;
    let record;
    try { record = JSON.parse(first.value); } catch { return false; }
    // An incomplete archive can still expose private records.
    return record?.kind === 'manifest' && record.format === FORMAT;
  } catch (error) {
    // Neither a binary asset (rer's line reader answers invalid UTF-8 with archive_json)
    // nor an overlong line is admitted by readArchive.
    if (error.code === 'archive_json' || error.code === 'ERR_ENCODING_INVALID_ENCODED_DATA' || error.message === 'An archive line exceeds the supported size.') return false;
    throw error;
  } finally { await lines.return(); }
}

async function inspect(path) {
  for (const entry of await readdir(path, {withFileTypes: true})) {
    const file = join(path, entry.name), stat = await lstat(file);
    if (stat.isSymbolicLink()) throw new Error('Public asset symlinks are unsupported; keep private archives outside public assets.');
    if (stat.isDirectory()) { await inspect(file); continue; }
    if (/\.rer(?:\.|$)/i.test(entry.name)) throw new Error('Private archive found in public assets. Move it to exports/ before building.');
    if (await hasArchiveManifest(file)) throw new Error('Archive content found in public assets. Move it to exports/ before building.');
  }
}
await inspect(fileURLToPath(new URL('../public', import.meta.url)));
