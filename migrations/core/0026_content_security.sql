CREATE TABLE chest_activity_events (id TEXT PRIMARY KEY, actor TEXT NOT NULL, source TEXT NOT NULL, kind TEXT NOT NULL, bytes INTEGER NOT NULL, at INTEGER NOT NULL);
CREATE INDEX chest_activity_actor_window ON chest_activity_events(actor,kind,at);
CREATE INDEX chest_activity_source_window ON chest_activity_events(source,kind,at);
CREATE TABLE chest_activity_alerts (id TEXT PRIMARY KEY, batch TEXT NOT NULL, subject TEXT NOT NULL, actor TEXT NOT NULL, rule TEXT NOT NULL, kind TEXT NOT NULL, detail TEXT NOT NULL, at INTEGER NOT NULL);
CREATE INDEX chest_activity_alert_window ON chest_activity_alerts(subject,rule,kind,at);
CREATE TABLE chest_activity_pauses (subject TEXT PRIMARY KEY, actor TEXT NOT NULL, rule TEXT NOT NULL, at INTEGER NOT NULL);
