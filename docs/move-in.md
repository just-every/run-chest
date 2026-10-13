Move-in brings an existing set of documents into Chest from one archive file. It
is under **Move-in** in the top bar, for the owner only.

## Prepare the archive

Move-in reads one JSON file in the documented `chest-archive-1` format. Each item
carries its original bytes (base64), their SHA-256 and their size, plus the
fields for the document type you will file it under:

```json
{
  "format": "chest-archive-1",
  "source": "supplier-records-2026-10",
  "items": [{
    "path": "Acme/certificate.txt",
    "title": "Acme certificate",
    "base64": "aGVsbG8=",
    "sha256": "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
    "size": 5,
    "fields": {"reference": "CERT-1"},
    "reference": {"kind": "supplier", "name": "Acme"},
    "reviewDate": "2026-12-01",
    "expiryDate": "2027-01-01",
    "principals": ["someone@example.com"],
    "decisions": [{"actor": "source reviewer", "decision": "approved"}]
  }]
}
```

An archive holds up to 100 items and 16 MB; each original up to 8 MB. Chest does
not read exports from other products directly: convert them to this format
first, and keep the source system until you have checked the result.

## Preview it

Choose the **Archive JSON file**, the **Destination collection**, the
**Document type**, the **Responsible owner** and the **Reviewer**, then press
**Preview archive**. Preview writes nothing. **Review archive mapping** lists
every item as admitted, skipped or rejected with its reason, along with
duplicate paths or bytes and the people and decisions Chest cannot carry over.
Unsafe paths or bytes that do not match their SHA-256 reject the archive.

## Apply it

If the preview is right, press **Apply this reviewed fingerprint**. Chest applies
exactly what you reviewed and shows an **Operation receipt** with a job ID. Keep
that ID.

Every imported record starts **private** and **unapproved**: people and approvals
from the source are kept as history, not turned into Chest access or Chest
approvals. Grant access and approve each record as you would a new one.

## Resume or undo a batch

Under **Resume or undo a batch**, enter the **Job ID** and choose an action, then
press **Run batch action**:

- **Inspect** shows the batch's progress.
- **Resume** continues a batch that stopped.
- **Undo untouched batch** removes the records it created, as long as nobody has
  edited them. If someone has, Chest keeps that edit and tells you.
