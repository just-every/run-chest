-- A native audit anonymization made before first agent admission cannot later
-- be contradicted by a new retained company-agent identity snapshot.
CREATE TABLE chest_agent_custody_blocks (
  operator_id TEXT PRIMARY KEY,
  reason TEXT NOT NULL CHECK(reason='audit_identity_anonymized')
);
CREATE TRIGGER chest_agent_custody_identity_fence
BEFORE INSERT ON agent_door_agents
WHEN EXISTS (SELECT 1 FROM chest_agent_custody_blocks WHERE operator_id=NEW.sponsor)
BEGIN
  SELECT RAISE(ABORT, 'agent_decision_custody_held');
END;
