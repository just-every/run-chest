-- Preserve the authority of any administrator created through the earlier native auth API.
-- Delegated administration now lives separately from content roles; require a fresh session after migration.
INSERT INTO chest_records(id,kind,payload,revision)
 SELECT 'admin:legacy:'||id,'admin-grant',json_object('email',email,'role','','super',json('true'),'scope','organization','groups',json('[]')),lower(hex(randomblob(16)))
 FROM oa_operators WHERE role='admin';
UPDATE oa_operators SET role='member' WHERE role='admin';
