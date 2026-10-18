import { DatabaseSync } from 'node:sqlite';
import { enforceJournal } from './journal.mjs';

export function checkDatabaseJournal(database, journal) {
  if (!journal) return;
  const db = new DatabaseSync(database, { readOnly: true });
  try { checkOpenDatabaseJournal(db, journal); } finally { db.close(); }
}
export function checkOpenDatabaseJournal(db, journal) {
  const tables = new Set(db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(t => t.name));
  const source = tables.has('rer_portability_state') ? db.prepare('SELECT source_identity FROM rer_portability_state WHERE id=1').get()?.source_identity : null;
  const entries = tables.has('chest_records') ? db.prepare("SELECT payload FROM chest_records WHERE kind='erasure-journal'").all().map(r => JSON.parse(r.payload)) : [];
  enforceJournal(journal, source, entries);
}
