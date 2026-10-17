-- Everyday files: an ordered change journal that sync clients read with a cursor,
-- and device credentials (hashes only), which never leave the installation.
CREATE TABLE chest_changes(seq INTEGER PRIMARY KEY AUTOINCREMENT, item TEXT NOT NULL, space TEXT NOT NULL, kind TEXT NOT NULL, at TEXT NOT NULL);
CREATE INDEX chest_changes_space ON chest_changes(space, seq);
CREATE TABLE chest_device_credentials(token_hash TEXT PRIMARY KEY, device TEXT NOT NULL UNIQUE, email TEXT NOT NULL, created_at TEXT NOT NULL, last_seen TEXT, revoked_at TEXT);
