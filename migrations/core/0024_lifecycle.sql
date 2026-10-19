-- Pending provider changes are installation authority, never portable grants.
CREATE TABLE chest_sso_group_reviews (
 id TEXT PRIMARY KEY,
 resource_id TEXT NOT NULL REFERENCES chest_scim_resources(id),
 revision TEXT NOT NULL,
 data TEXT NOT NULL CHECK(json_valid(data)),
 status TEXT NOT NULL CHECK(status IN ('pending','applied','declined','superseded')),
 created_at TEXT NOT NULL,
 decided_at TEXT
);
CREATE UNIQUE INDEX chest_sso_one_group_review ON chest_sso_group_reviews(resource_id) WHERE status='pending';
