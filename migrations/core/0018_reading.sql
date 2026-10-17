-- The installation's AI model key for reading scans (src/chest/read/settings.ts), sealed under SESSION_SECRET.
-- Like sync device credentials, archives never carry it: a restored Chest asks the owner to add it again.
CREATE TABLE chest_reader(id INTEGER PRIMARY KEY CHECK(id=1), provider TEXT NOT NULL, endpoint TEXT NOT NULL, model TEXT NOT NULL, workspace TEXT NOT NULL, key_sealed TEXT NOT NULL, key_hint TEXT NOT NULL, updated_by TEXT NOT NULL, updated_at TEXT NOT NULL);
