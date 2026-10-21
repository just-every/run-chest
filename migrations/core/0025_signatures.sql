-- The installation's document signing key (src/chest/signatures/custody.ts): an ECDSA P-256 private key sealed under
-- SESSION_SECRET with its self-signed certificate. Like the reading key and sync device credentials, archives never
-- carry it: a restored Chest makes a new key, and documents sealed earlier still validate from their embedded certificate.
CREATE TABLE chest_signing_key(id INTEGER PRIMARY KEY CHECK(id=1), key_sealed TEXT NOT NULL, certificate TEXT NOT NULL, fingerprint TEXT NOT NULL, created_at TEXT NOT NULL);
