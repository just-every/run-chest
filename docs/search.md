# Find a file or an earlier version

Open **Files**, search for words, then use the filters below the search box.
Choose several types to include any of those types. People, dates, location and
version filters combine, so a PDF in a chosen folder can also be limited to a
creator and a date range. Dates use the US time zone selected on the form.

**Any retained version** finds text that changed in a later upload. Each match
names its earlier version; open the file and use Version history to inspect or
download that version. Current versions are searched by default.

Location includes nested folders. Shared with me, Starred, My files and Trash
can also be searched. Trash results require your current access and either your
own trash action or management rights. Nothing inaccessible contributes to
results, counts or the people and folder choices.

The search API accepts repeated or comma-separated `type`, `owner`, `creator`
and `sharedBy` values; `modifiedFrom`, `modifiedTo` (inclusive dates), `timeZone`,
`location` (a folder/space ID, `anywhere`, `personal`, `shared`, `starred` or
`trash`) and `versions=current|any`. `me` selects the caller for a person filter.
Team content belongs to its space; a personal-area owner filter selects that
person's files. `modified=today|7|30|year|lastYear` supplies a date range when
no explicit dates are given. Results return `matchedVersion`, `versionLabel`,
`count` and `truncated`; refine a search that exceeds 200 displayed results.

File categories use detected content. PDF signatures still identify PDFs renamed
as text files; Office packages are categorized after their text is read. Unknown
binary formats stay Other. OCR requires the installation's reader key; unread
content and unsupported formats are described on each file page. The complete
format and native-app targets remain partial in the contract.

## Confirm values read from scans

In a folder with a document type, a scanned PDF or photo is read for that
type's fields. Open the file to see the proposed values, confidence and source
boxes. A contributor can Accept, Correct or Reject each reading. A viewer can
inspect the reading but cannot save it. Unreadable fields remain empty.

Nothing is saved until confirmation. A value already saved is kept beside any
differing reading. Correct typed filing deliberately if it needs changing; a
scan cannot silently replace it. W-9 TIN readings and corrections store a masked
last four digits. The source original remains governed by the file's access.

New versions keep old decisions on their source version and propose changed or
still-undecided values. Changed document types invalidate stale confirmations.
A folder manager can enable **Read required fields after scan upload**. PDFs and
photos may then arrive with required values empty, and approval is blocked until
a person confirms or enters them. Other uploads still require their typed values.
The installation's reader provider and key are set in People & settings.

## Search parameters moved from the contract

Moved out of CONTRACT.md on 28 October 2026; the contract links here where it needs these rules.

- Filters work in the browser at 1440 and 390, in the iOS and Android apps, and through the CONNECT-007 search API as named parameters (`type`, `owner`, `creator`, `sharedBy`, `modifiedFrom`, `modifiedTo`, `location`, `versions`).
