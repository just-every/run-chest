CREATE TABLE chest_sso_config (singleton INTEGER PRIMARY KEY CHECK(singleton=1), payload TEXT NOT NULL, revision TEXT NOT NULL, tested_at TEXT, local_disabled INTEGER NOT NULL DEFAULT 0);
CREATE TABLE chest_sso_transactions (state_hash TEXT PRIMARY KEY, binding_hash TEXT NOT NULL, payload TEXT NOT NULL, expires_at INTEGER NOT NULL);
CREATE TABLE chest_saml_requests (id TEXT PRIMARY KEY, value TEXT NOT NULL, created_at INTEGER NOT NULL);
CREATE TABLE chest_storage_assert(ok INTEGER NOT NULL CONSTRAINT storage_limit_exceeded CHECK(ok=1));
