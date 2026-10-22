import { DatabaseSync } from 'node:sqlite';
import { readFile, chmod, open } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';

export const ident = name => '"' + name.replaceAll('"', '""') + '"';
export const literal = value => value === null ? 'NULL' : typeof value === 'bigint' || typeof value === 'number' ? String(value) : ArrayBuffer.isView(value) ? `X'${Buffer.from(value.buffer, value.byteOffset, value.byteLength).toString('hex')}'` : "'" + String(value).replaceAll("'", "''") + "'";
const portableAuth = new Set(['oa_operators', 'oa_invitation_cancellations', 'oa_auth_audit']);
export const excludedTable = name =>
  name.startsWith('oa_') && !portableAuth.has(name) || name.startsWith('oc_') ||
  name.startsWith('rer_dependency_') || name.startsWith('rer_portability_') && !['rer_portability_state', 'rer_portability_journal', 'rer_portability_epochs'].includes(name) ||
  name.startsWith('ik_door_') && !['ik_door_namespaces'].includes(name) ||
  /^(chest_(mfa_(?!policy)|sso_|saml_|scim_tokens$|scim_resources$|device_credentials$|integration_secrets$|reader$|signing_key$)|rer_mail_)/.test(name);
const ephemeralKind = /^(device|guest-challenge|guest-session|request-visitor|request-challenge|transfer-session|office-presence|editor-session|wopi-lock|reader-config|backup-configuration|upload-part|request-upload-part)$/;
const authorityKey = /^(?:token(?:_?hash)?|password|secret|client_?secret|api_?key|key_?sealed|private_?key|access_?token|refresh_?token|authorization|cookie|session(?:_?id)?|session_?fingerprint|credential(?:s)?|binding_?hash|signing_?key)$/i;
const jobKind = /(?:send|mail|notification|dispatch|delivery)-job$/;
const inertAt = '1970-01-01T00:00:00.000Z';

function cleanValue(value, encoded = true) {
  if (Array.isArray(value)) return value.map(v => cleanValue(v, encoded));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).filter(([k]) => !authorityKey.test(k)).map(([k,v]) => [k, cleanValue(v, encoded)]));
  // Import execution snapshots sometimes encode JSON inside JSON columns.
  if (encoded && typeof value === 'string' && /^[\s]*[\[{]/.test(value)) {
    try { const parsed=JSON.parse(value), clean=cleanValue(parsed); return isDeepStrictEqual(parsed,clean) ? value : JSON.stringify(clean); } catch {}
  }
  return value;
}
export function sanitizeRecord(kind, payload) {
  if (ephemeralKind.test(kind)) return null;
  const value = cleanValue(payload, !['item','document','extraction'].includes(kind));
  // Typed fields and extracted document text are business content, even when a
  // customer names a field token/secret. Credentials live in excluded authority
  // stores or execution records, never in these typed value maps.
  if (kind === 'document' && payload.fields) value.fields = structuredClone(payload.fields);
  if (kind === 'item' && payload.filing?.fields) value.filing.fields = structuredClone(payload.filing.fields);
  if (['link', 'public-link'].includes(kind)) { value.tokenHash = ''; value.password = null; value.revokedAt ??= inertAt; value.expires = inertAt; }
  if (kind === 'file-request') { value.tokenHash = ''; value.closedAt ??= inertAt; }
  if (kind === 'content-policy') value.enabled = false;
  if (kind === 'collection-checklist') value.sendReminders = false;
  if (kind === 'backup-settings') { value.enabled = false; value.requestedAt = null; value.lastClaim = null; }
  if (kind === 'backup-run') { if (['pending','running'].includes(value.state)) value.state = 'interrupted'; value.notifiedAt ??= inertAt; }
  if (['filing_scope','intake'].includes(kind)) value.enabled = false;
  if (kind === 'link-scope') value.automatic = false;
  if (kind === 'expiry') { value.noticeAt ??= inertAt; value.expiredAt ??= inertAt; }
  if (['upload','request-upload'].includes(kind)) { if(value.state==='open')value.state='interrupted'; delete value.multipart; delete value.key; value.expiresAt=inertAt; value.expires=inertAt; }
  if (kind === 'notice' && value.email === 'queued') value.email = 'suppressed:restored_archive';
  if (kind === 'collection-reminder' && value.status === 'queued') value.status = 'suppressed:restored_archive';
  if (jobKind.test(kind)) { value.state = 'cancelled'; value.status = 'cancelled'; value.replay = false; value.restoredInert = true; }
  return value;
}
export function tables(db) {
  const rows = db.prepare("SELECT name,sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' ORDER BY name").all();
  if (rows.some(t => /CREATE\s+VIRTUAL/i.test(t.sql))) throw new Error('Virtual database tables need an explicit backup policy.');
  return rows;
}
function rows(db, name) { const statement = db.prepare(`SELECT rowid AS __backup_rowid__,* FROM ${ident(name)}`); statement.setReadBigInts(true); return statement.iterate(); }
function sanitizeDatabase(db) {
  db.exec('PRAGMA foreign_keys=OFF; PRAGMA secure_delete=ON;');
  const triggers = db.prepare("SELECT name,sql FROM sqlite_master WHERE type='trigger'").all();
  for (const t of triggers) db.exec(`DROP TRIGGER ${ident(t.name)}`);
  for (const {name} of tables(db)) {
    if (excludedTable(name)) { db.exec(`DELETE FROM ${ident(name)}`); continue; }
    if (name === 'rer_portability_state') db.exec('UPDATE rer_portability_state SET import_job=NULL,applying=0');
    for (const row of rows(db, name)) {
      if (name === 'chest_records') {
        const value = sanitizeRecord(row.kind, JSON.parse(row.payload));
        if (value === null) { db.prepare(`DELETE FROM chest_records WHERE id=?`).run(row.id); continue; }
        db.prepare('UPDATE chest_records SET payload=? WHERE id=?').run(JSON.stringify(value), row.id);
      } else {
        for (const [column, value] of Object.entries(row)) {
          if (column === '__backup_rowid__' || typeof value !== 'string') continue;
          let sanitized = value;
          if (authorityKey.test(column)) sanitized = '';
          else { try { const json = JSON.parse(value); if (json && typeof json === 'object') sanitized = JSON.stringify(cleanValue(json)); } catch {} }
          if (sanitized !== value) db.prepare(`UPDATE ${ident(name)} SET ${ident(column)}=? WHERE rowid=?`).run(sanitized, row.__backup_rowid__);
        }
      }
    }
  }
  for (const t of triggers) db.exec(t.sql);
}

export async function sanitizeExport({ sql, scratch, output }) {
  const db = new DatabaseSync(scratch);
  try {
    // D1's real schema export is parsed by SQLite, never by a lossy SQL splitter.
    db.exec(await readFile(sql, 'utf8')); sanitizeDatabase(db);
    db.exec(`VACUUM INTO ${literal(output)}`);
  } finally { db.close(); }
  await chmod(output, 0o600);
  return inspectDatabase(output);
}

export function inspectDatabase(file) {
  const db = new DatabaseSync(file, { readOnly: true });
  try {
    if (db.prepare('PRAGMA integrity_check').get().integrity_check !== 'ok') throw new Error('Backup database integrity failed.');
    const schema = tables(db);
    for (const {name} of schema) {
      if (excludedTable(name) && db.prepare(`SELECT 1 FROM ${ident(name)} LIMIT 1`).get()) throw new Error('Archive contains installation authority.');
      if (name === 'rer_portability_state' && db.prepare('SELECT 1 FROM rer_portability_state WHERE import_job IS NOT NULL OR applying<>0 LIMIT 1').get()) throw new Error('Archive contains an active transfer.');
      if (!excludedTable(name)) for (const row of rows(db, name)) {
        if (name === 'chest_records') {
          const payload = JSON.parse(row.payload), sanitized = sanitizeRecord(row.kind, payload);
          if (!sanitized || !isDeepStrictEqual(sanitized,payload)) throw new Error('Archive contains active capabilities or queued sending jobs.');
        } else for (const [column, value] of Object.entries(row)) {
          if (typeof value !== 'string') continue;
          if (authorityKey.test(column) && value) throw new Error('Archive contains authority fields.');
          try { const json = JSON.parse(value); if (json && typeof json === 'object' && JSON.stringify(cleanValue(json)) !== JSON.stringify(json)) throw new Error('Archive contains secret JSON fields.'); }
          catch (e) { if (e.message === 'Archive contains secret JSON fields.') throw e; }
        }
      }
    }
    const migrations = schema.some(t => t.name === 'd1_migrations') ? db.prepare('SELECT name FROM d1_migrations ORDER BY id').all().map(r => r.name) : [];
    const originals = new Map();
    if (schema.some(t => t.name === 'chest_records')) for (const {payload} of db.prepare("SELECT payload FROM chest_records WHERE kind IN ('document','item')").iterate()) {
      for (const v of JSON.parse(payload).versions ?? []) {
        if (!/^[a-f0-9]{64}$/.test(v.checksum) || !Number.isSafeInteger(v.size) || v.size < 0 || originals.has(v.checksum) && originals.get(v.checksum) !== v.size) throw new Error('Invalid original reference in database.');
        originals.set(v.checksum, v.size);
      }
    }
    return { schema, migrations, originals: [...originals].map(([sha256,size]) => ({sha256,size})) };
  } finally { db.close(); }
}
export function reconcileOriginals(database, entries) {
  const held = new Map(entries.filter(e => e.path.startsWith('objects/')).map(e => [e.sha256,e.size]));
  for (const original of database.originals) if (held.get(original.sha256) !== original.size) throw new Error('Archive is missing an original version or its recorded size differs.');
}

const normalize = sql => sql.replace(/\bIF\s+NOT\s+EXISTS\b/gi,'').replace(/["`\s]/g,'').replace(/;$/,'').toLowerCase();
export function sameSchema(source, target) {
  const clean = rows => rows.filter(t => !t.name.startsWith('sqlite_') && !t.name.startsWith('_cf_')).map(t => [t.name,normalize(t.sql)]).sort((a,b) => a[0].localeCompare(b[0]));
  return JSON.stringify(clean(source)) === JSON.stringify(clean(target));
}
export async function restorePlan({ database, output, targetSchema, triggers }) {
  const db = new DatabaseSync(database, { readOnly: true }), out = await open(output, 'wx', 0o600);
  try {
    if (!sameSchema(tables(db), targetSchema)) throw new Error('Target database schema differs from backup.');
    const write = line => out.write(line + '\n');
    await write('PRAGMA defer_foreign_keys=TRUE;');
    for (const t of triggers) await write(`DROP TRIGGER ${ident(t.name)};`);
    const pending = [...tables(db)], ordered = [];
    while (pending.length) {
      const index = pending.findIndex(t => pending.every(c => c === t || !new RegExp('REFERENCES\\s+["`]?'+t.name+'(?:["`\\s(])','i').test(c.sql)));
      ordered.push(pending.splice(index < 0 ? 0 : index,1)[0]);
    }
    for (const t of ordered) await write(`DELETE FROM ${ident(t.name)};`);
    for (const {name} of tables(db)) for (const row of rows(db,name)) {
      delete row.__backup_rowid__;
      await write(`INSERT INTO ${ident(name)}(${Object.keys(row).map(ident).join(',')}) VALUES(${Object.values(row).map(literal).join(',')});`);
    }
    if (targetSchema.some(t => t.name === 'oa_bootstrap')) await write(`INSERT INTO oa_bootstrap(singleton,claim_id,claimed_at) VALUES(1,${literal(randomUUID())},${Date.now()});`);
    if (targetSchema.some(t => t.name === 'rer_dependency_installation')) await write(`INSERT INTO rer_dependency_installation(singleton,sector_id) VALUES(1,${literal(randomUUID())});`);
    for (const t of triggers) await write(t.sql + ';');
  } finally { db.close(); await out.close(); }
}
