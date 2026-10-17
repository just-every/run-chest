-- SCIM admission and credentials are installation-local authentication state.
-- Keep these tables out of portable archives; chest_records remain portable.
CREATE TABLE chest_scim_tokens (
 id TEXT PRIMARY KEY,
 token_hash TEXT NOT NULL UNIQUE,
 name TEXT NOT NULL,
 owner_id TEXT NOT NULL REFERENCES oa_operators(id),
 owner_version INTEGER NOT NULL,
 created_by TEXT NOT NULL,
 created_at TEXT NOT NULL,
 revoked_at TEXT,
 revoked_by TEXT
);
CREATE TABLE chest_scim_resources (
 id TEXT PRIMARY KEY,
 resource_type TEXT NOT NULL CHECK(resource_type IN ('User','Group')),
 record_id TEXT NOT NULL UNIQUE REFERENCES chest_records(id),
 operator_id TEXT UNIQUE REFERENCES oa_operators(id),
 external_id TEXT,
 data TEXT NOT NULL CHECK(json_valid(data)),
 revision TEXT NOT NULL,
 created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL,
 deleted INTEGER NOT NULL DEFAULT 0 CHECK(deleted IN (0,1)),
 CHECK((resource_type='User' AND operator_id IS NOT NULL) OR (resource_type='Group' AND operator_id IS NULL)),
 UNIQUE(resource_type,external_id)
);
CREATE INDEX chest_scim_type ON chest_scim_resources(resource_type,deleted,id);
