-- Authentication secrets are deliberately outside portable chest_records archives.
CREATE TABLE chest_mfa_policy (singleton INTEGER PRIMARY KEY CHECK(singleton=1), payload TEXT NOT NULL, revision TEXT NOT NULL);
CREATE TABLE chest_mfa_factors (id TEXT PRIMARY KEY, operator_id TEXT NOT NULL REFERENCES oa_operators(id), kind TEXT NOT NULL CHECK(kind IN ('totp','webauthn')), payload TEXT NOT NULL, counter INTEGER NOT NULL DEFAULT -1, created_at INTEGER NOT NULL);
CREATE INDEX chest_mfa_factor_owner ON chest_mfa_factors(operator_id);
CREATE TABLE chest_mfa_challenges (session_id TEXT PRIMARY KEY, purpose TEXT NOT NULL, payload TEXT NOT NULL, expires_at INTEGER NOT NULL);
CREATE TABLE chest_mfa_verified (session_id TEXT PRIMARY KEY, method TEXT NOT NULL, verified_at INTEGER NOT NULL, last_seen INTEGER NOT NULL);
CREATE TABLE chest_mfa_recovery (operator_id TEXT NOT NULL REFERENCES oa_operators(id), digest TEXT NOT NULL, PRIMARY KEY(operator_id,digest));
CREATE TABLE chest_mfa_limits (operator_id TEXT NOT NULL, window INTEGER NOT NULL, attempts INTEGER NOT NULL, PRIMARY KEY(operator_id,window));
CREATE TABLE chest_mfa_resets (digest TEXT PRIMARY KEY, operator_id TEXT NOT NULL REFERENCES oa_operators(id), expires_at INTEGER NOT NULL, consumed_at INTEGER);
