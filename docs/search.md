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
