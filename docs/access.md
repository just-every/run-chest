## Roles

Chest has three roles. Each one includes reading.

| Role | Can |
| --- | --- |
| reader | Find, open, preview and download the record. |
| editor | Also upload, submit replacements and change the filing. |
| reviewer | Also record decisions on versions assigned to them. |

Give someone both **editor** and **reviewer** when they need both. Being
assigned as a record's reviewer grants nothing by itself: they also need the
reviewer role on it.

## Grant access to a collection

In **People & settings → Collections and access**, each collection has its
grants as a JSON list. Each grant names a principal (a person's email or a
group's ID) and a role:

```json
[
  { "principal": "maria@example.com", "role": "reviewer" },
  { "principal": "group-id-from-groups", "role": "reader" }
]
```

Press **Save collection access**. Every record in the collection follows it.

## Grant access to one document

The owner sees **Document access** on each record: its own grants, in the same
form, and **Private: ignore collection grants**. A private record is visible only
through its own grants. Press **Save access**.

## See who can read a record

The owner sees **Effective readers** on each record: every active person who can
read it right now, by name and email, with the roles that give them access.

## Remove access

Change or remove the grant and save. The change reaches every door at once:
the library list, counts, search, the record, previews and downloads. To stop
someone entirely, use **Deactivate and revoke sessions** in **People & settings**;
their sessions end immediately.
