-- Scheduled sweeps and per-request background work read only the rows that are due, never a whole kind of record.
-- Each index below matches one sweep query literally, so SQLite can use its partial predicate.

-- Webhook events are fetched by their position in the event clock instead of scanning every event ever stored.
ALTER TABLE chest_integration_secrets ADD COLUMN position INTEGER;
UPDATE chest_integration_secrets SET position=CAST(json_extract(value,'$.position') AS INTEGER) WHERE id LIKE 'event:%';
CREATE INDEX chest_event_position ON chest_integration_secrets(position) WHERE position IS NOT NULL;

-- Share expiry notices and expired grants; pending access requests by deadline.
CREATE INDEX chest_expiry_due ON chest_records(json_extract(payload,'$.expires')) WHERE kind='expiry';
CREATE INDEX chest_request_pending ON chest_records(json_extract(payload,'$.expiresAt')) WHERE kind='request' AND json_extract(payload,'$.status')='pending';

-- Webhook deliveries that are pending or stuck sending, found by state.
CREATE INDEX chest_delivery_state ON chest_records(json_extract(payload,'$.state'),id) WHERE kind='integration-delivery';

-- Signature requests that can still send reminders or expire; failed backup runs the owner has not been told about.
CREATE INDEX chest_signature_pending ON chest_records(id) WHERE kind='signature' AND json_extract(payload,'$.status')='pending';
CREATE INDEX chest_backup_unnotified ON chest_records(json_extract(payload,'$.state'),id) WHERE kind='backup-run' AND json_extract(payload,'$.notifiedAt') IS NULL;

-- The newest collection reminder per checklist and recipient.
CREATE INDEX chest_collection_reminder_latest ON chest_records(json_extract(payload,'$.collection'),json_extract(payload,'$.recipient'),json_extract(payload,'$.at')) WHERE kind='collection-reminder';

-- Reading work: the next extraction or field reading with work left, and RTF extractions from an older parser.
CREATE INDEX chest_extract_open ON chest_records(json_extract(payload,'$.createdAt')) WHERE kind='extract' AND json_extract(payload,'$.state') IN ('queued','reading');
CREATE INDEX chest_reading_open ON chest_records(json_extract(payload,'$.createdAt')) WHERE kind='reading' AND json_extract(payload,'$.state') IN ('waiting','reading');
CREATE INDEX chest_extract_rtf ON chest_records(id) WHERE kind='extract' AND (json_extract(payload,'$.mediaType')='application/rtf' OR json_extract(payload,'$.format')='RTF document');

-- Files and records whose readable versions may still need an extraction or field reading. Any write to a file or
-- record marks it (n counts the writes, so a pass clears only what it saw); the reader works through the marks.
CREATE TABLE chest_reader_dirty(id TEXT PRIMARY KEY,n INTEGER NOT NULL);
CREATE TRIGGER chest_reader_dirty_insert AFTER INSERT ON chest_records WHEN NEW.kind IN ('item','document') BEGIN
 INSERT INTO chest_reader_dirty(id,n) VALUES(NEW.id,1) ON CONFLICT(id) DO UPDATE SET n=n+1;
END;
CREATE TRIGGER chest_reader_dirty_update AFTER UPDATE ON chest_records WHEN NEW.kind IN ('item','document') BEGIN
 INSERT INTO chest_reader_dirty(id,n) VALUES(NEW.id,1) ON CONFLICT(id) DO UPDATE SET n=n+1;
END;
-- Once, for what exists now: mark every file or record that already has a readable version without an extraction,
-- or a newest readable version that should have a field reading and has none.
INSERT OR IGNORE INTO chest_reader_dirty(id,n)
SELECT r.id,1 FROM chest_records r WHERE r.kind IN ('item','document') AND (
 EXISTS (SELECT 1 FROM json_each(r.payload,'$.versions') v WHERE json_extract(v.value,'$.mediaType') IN ('application/rtf','application/pdf','image/jpeg','image/png','image/webp','image/gif','image/heic','image/tiff','application/octet-stream') AND NOT EXISTS (SELECT 1 FROM chest_records e WHERE e.id='extract:'||json_extract(v.value,'$.checksum')))
 OR (((r.kind='document' AND json_extract(r.payload,'$.trash')=0) OR (r.kind='item' AND json_extract(r.payload,'$.trash') IS NULL AND json_extract(r.payload,'$.filing.schema') IS NOT NULL)) AND json_extract(r.payload,'$.versions[#-1].mediaType') IN ('application/rtf','application/pdf','image/jpeg','image/png','image/webp','image/gif','image/heic','image/tiff','application/octet-stream') AND NOT EXISTS (SELECT 1 FROM chest_records x WHERE x.id='reading:'||r.id||':'||json_extract(r.payload,'$.versions[#-1].id'))));
