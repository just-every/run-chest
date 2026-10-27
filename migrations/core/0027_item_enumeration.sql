-- Bound metadata scans by kind and stable item identifier.
CREATE INDEX chest_item_enumeration ON chest_records(kind, id);
CREATE INDEX chest_space_enumeration ON chest_records(json_extract(payload,'$.space'), id) WHERE kind='item';
