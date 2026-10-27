-- Sibling operations read one live folder rather than every item in its space.
CREATE INDEX chest_folder_items ON chest_records(json_extract(payload,'$.space'), json_extract(payload,'$.parent'), id) WHERE kind='item' AND json_extract(payload,'$.trash') IS NULL;
