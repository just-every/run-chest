-- Content threats (src/chest/threats, SECURITY-002). The separately deployed malware scanner's address and its token,
-- sealed under SESSION_SECRET; like the reading key, archives never carry it. Scan verdicts themselves are records
-- (kind 'scan'), so a restored Chest keeps every quarantine.
CREATE TABLE chest_scanner(id INTEGER PRIMARY KEY CHECK(id=1), endpoint TEXT NOT NULL, token_sealed TEXT NOT NULL, token_hint TEXT NOT NULL, updated_by TEXT NOT NULL, updated_at TEXT NOT NULL);
-- A short journal of downloads and deletions per account and per device or token, read by the mass-activity rules
-- and pruned after a day. It holds counts, never content.
CREATE TABLE chest_activity(id TEXT PRIMARY KEY, actor TEXT NOT NULL, source TEXT NOT NULL, kind TEXT NOT NULL, item TEXT, bytes INTEGER NOT NULL DEFAULT 0, at INTEGER NOT NULL);
CREATE INDEX chest_activity_actor ON chest_activity(actor, kind, at);
CREATE INDEX chest_activity_source ON chest_activity(source, kind, at);
