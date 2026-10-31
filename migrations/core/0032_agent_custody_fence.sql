-- Chest owns this conservative custody fence. Retained Base decisions cannot yet
-- be redacted per client, so native erasure and first agent admission must not race.
-- Existing agent registrations cause an explicit native preservation hold.
CREATE TRIGGER chest_agent_custody_erasure_fence
BEFORE INSERT ON agent_door_agents
WHEN EXISTS (
  SELECT 1 FROM chest_records
  WHERE kind='erasure' AND json_extract(payload,'$.state')='pending'
)
BEGIN
  SELECT RAISE(ABORT, 'agent_custody_erasure_pending');
END;
