# Repair a device sync queue

Chest includes a runnable Node 22 companion for one selected Chest folder. It
downloads the folder's currently visible descendants into a real local directory,
then sends edits to those tracked files through Chest's device API. It records
actual file hashes, interrupted downloads, conflicts and cache health. It is a
command line companion; it does not install a native app or a background service.

In **Sync devices**, enroll a device and keep its one-time credential private.
Supply it through `CHEST_DEVICE_TOKEN` in the companion process's environment,
using a private secret manager or environment file outside this checkout and any
served directory. Do not put a credential in arguments, source or shell history.
Choose the folder's stable ID and a local directory that is not served publicly.

```sh
node scripts/sync-companion/cli.mjs --origin https://chest.example --folder FOLDER_ID --root /private/path/chest-files
```

Use an HTTPS origin, without a path, credentials or query. TLS verification stays
enabled and redirects are refused. `--allow-http` permits local tests only at
literal `localhost`, `127.0.0.1` or `[::1]`.

The first run downloads visible files; it never uploads unrelated existing local
files. An existing local file with different bytes waits as a conflict. Later
runs hash local files, refresh the authorized server tree and compare original
response bytes with the server's SHA-256 and size. A file is reported
`up-to-date` only after both ends match an exact current version. Edits to a
tracked file use its stored base version in `If-Match`. If that base is stale,
Chest keeps the current remote version and creates a named conflict copy from
the local bytes. The companion preserves the local file and reports the conflict
copy's stable ID for a person to inspect.

Pause transfers with:

```sh
node scripts/sync-companion/cli.mjs --origin https://chest.example --folder FOLDER_ID --root /private/path/chest-files --pause
```

The paused queue survives process exit. Repeating the ordinary command does not
resume it. `--resume` is explicit local permission to continue; a matching resume
grant issued through Chest's sync repair workflow also resumes it. `--pause`
wins over a grant. The companion consumes the current grant before sending its
new queue report, then reports actual queue state before and after transfers.
Reports continue while paused; file uploads and downloads do not.

State and partial downloads live under `.chest-sync/` inside the local root.
Its directories are private (0700), state and new downloaded files are private
(0600), and the manifest is written atomically with a durable rename. A process
lock prevents concurrent companion runs against the same root; a lock belonging
to a process that has exited can be recovered on the next run. A root is bound
to one origin and folder. Keep that state with its directory: it contains base
versions and queue evidence, but never the device credential.

After an interrupted download, rerun the command. It resumes the immutable
version using a range request and hashes the complete assembled file before
publishing it. A changed remote version gets a separate staging file; partial
bytes are not mistaken for a completed local file. Low free space produces
`insufficient_cache`, retaining the queue. Prior cache bytes replaced by a
verified remote version are retained privately under `.chest-sync/retained/`.
No automated cache deletion is performed.

Conflicts, revoked access, unsafe paths and uncertain upload outcomes wait for a
person. The companion never deletes a remote or local file, widens permissions,
or retries an uncertain content PUT: a lost response may already have committed
or made a conflict copy. Check the remote version history and conflict item,
preserve the wanted local bytes and reconcile them deliberately before starting
with a new local root. Revocation leaves existing local bytes in place; control
those bytes through the device's ordinary security and retention practices.

This bounded companion handles up to 500 tracked files per folder/root. It does
not upload newly created local files, propagate local deletion or rename, move
files after remote path changes, resolve conflicts, clean cache, or provide a
backup. Symlinks, hard-linked local files, path traversal, reserved metadata
names and ambiguous local paths are refused. Existing local permissions are
preserved; new files are private. A concurrently open editor's prior inode is
retained when a verified remote version replaces an unchanged cached file.

The command prints JSON with each tracked path, base version, observed local
checksum, queue state and reason. Exit 0 means verified or intentionally paused,
2 means queued/conflicted/failed work remains, and 1 means an invocation or
transport failure. The importable entry point is
`runCompanion({ origin, folder, root, token, pause, resume, allowHttp, fetch })`
from `scripts/sync-companion/run.mjs` or `cli.mjs`; omitted `fetch` uses Node's
normal fetch. Integration callers can supply the real Worker's HTTP transport.
