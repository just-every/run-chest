## Upload a document

In the library, press **Upload a document** and fill in the form:

| Field | What it is |
| --- | --- |
| Title | The record's name, such as *Public liability certificate*. |
| Collection | Where it is filed; the collection's grants apply to it. |
| Document type | What it is; the type decides its required fields. |
| Typed fields (JSON) | The type's field values, for example `{"policy number": "PL-448120"}`. |
| Responsible owner | The person accountable for the record. |
| Reviewer | The person who approves its versions. |
| Business relationship | None, Supplier, Customer or Project. |
| Relationship name | The supplier, customer or project, such as *Kestrel Freight*. |
| Next review | Optional date it should be reviewed. |
| Expiry | Optional date it expires. |
| Original file | The file itself, up to 8 MB. |

Press **Upload and submit**. Chest checks the file's bytes, size and SHA-256
fingerprint before the record appears, keeps the original filename, and opens
the new record. Its first version waits for the reviewer's approval; the library
shows it as **Awaiting approval** until then.

The upload form appears once at least one collection and one document type
exist (see [Set up your library](/docs/set-up)).

## Change the filing

On a record, **Edit filing and responsibility** opens the same fields (without
the file). Press **Save filing**. Moving a record to another collection needs
editor access to the record and to the destination; its access then follows
the destination collection. Versions and decisions are unchanged.

## Find a record

The library lists every record you can access, with its approved file, number
of versions, owner, review date and expiry date. Use the search field,
**Search titles, fields and extracted UTF-8 text**, to find records by title,
by any typed field, or by words inside text files. Search covers the text of
plain text files up to 500 kB; it does not read inside PDFs or images.

## Open, preview and download

Each version on a record has **Download original**, which returns the exact
bytes that were uploaded. PDFs and images also have **Open safe pdf preview**
or **Open safe image preview**, which open in the browser's own viewer; text
files open as plain text. Other formats show
**Preview unavailable for this format; download the original.**

## Next

[Versions and approval](/docs/versions): replace a document and approve the new
version.
