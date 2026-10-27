-- Bound metadata scans by kind and stable item identifier.
CREATE INDEX chest_item_enumeration ON chest_records(kind, id);
