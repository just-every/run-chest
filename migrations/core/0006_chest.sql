CREATE TABLE chest_records (
 id TEXT PRIMARY KEY, kind TEXT NOT NULL, payload TEXT NOT NULL CHECK(json_valid(payload)), revision TEXT NOT NULL
);
CREATE INDEX chest_kind ON chest_records(kind);
CREATE TABLE chest_audit(id TEXT PRIMARY KEY, actor TEXT NOT NULL, action TEXT NOT NULL, object_id TEXT NOT NULL, detail TEXT NOT NULL, at TEXT NOT NULL);
CREATE TABLE chest_assert(ok INTEGER NOT NULL CHECK(ok=1));
