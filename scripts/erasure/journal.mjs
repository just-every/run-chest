import { readFile } from 'node:fs/promises';

export class ErasureFenceError extends Error {}
export const offlineDisclosure = 'An offline archive cannot reveal erasures made after it was saved. Supply --erasure-journal FILE exported from the source Chest, or explicitly accept that risk with --acknowledge-offline-erasures. Nothing was restored.';
const keys = ['id', 'at', 'items', 'documents', 'identities', 'checksums'];
const digest = /^[a-f0-9]{64}$/;
export function validateJournal(value) {
  const invalid = () => { throw new ErasureFenceError('Invalid Chest source erasure journal. Nothing was restored.'); };
  if (!value || value.format !== 'chest-erasure-journal-1' || typeof value.source !== 'string' || !value.source || !Array.isArray(value.entries)) invalid();
  const ids = new Set();
  for (const entry of value.entries) {
    if (!entry || Object.keys(entry).sort().join() !== [...keys].sort().join() || typeof entry.id !== 'string' || !entry.id || ids.has(entry.id) || typeof entry.at !== 'string' || !Number.isFinite(Date.parse(entry.at))) invalid();
    ids.add(entry.id);
    for (const key of keys.slice(2)) {
      if (!Array.isArray(entry[key]) || entry[key].some(v => typeof v !== 'string' || !v || (['identities', 'checksums'].includes(key) && !digest.test(v))) || new Set(entry[key]).size !== entry[key].length) invalid();
    }
  }
  return value;
}
export async function restoreConsent({ erasureJournal, acknowledgeOfflineErasures = false } = {}) {
  if (erasureJournal) {
    try { return validateJournal(JSON.parse(await readFile(erasureJournal, 'utf8'))); }
    catch (error) { if (error instanceof ErasureFenceError) throw error; throw new ErasureFenceError('Cannot read the source erasure journal. Nothing was restored.'); }
  }
  if (!acknowledgeOfflineErasures) throw new ErasureFenceError(offlineDisclosure);
  return null;
}
export function entryKey(entry) {
  // Array order is immaterial; every erased identity and byte digest is bound.
  return JSON.stringify(keys.map(key => Array.isArray(entry[key]) ? [...entry[key]].sort() : entry[key]));
}
export function enforceJournal(journal, source, archivedEntries) {
  if (!journal) return;
  if (!source || source !== journal.source) throw new ErasureFenceError('The erasure journal source does not match the archive database identity (or the archive has no retained source identity). Nothing was restored.');
  const archived = new Set(archivedEntries.map(entryKey));
  if (journal.entries.some(entry => !archived.has(entryKey(entry)))) throw new ErasureFenceError('Restore refused: the source journal contains later erasures absent from this archive. The entire archive is refused to prevent resurrection of originals, identities or retained import custody. Nothing was restored.');
}
