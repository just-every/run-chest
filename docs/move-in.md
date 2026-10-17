**Move in** (in the top bar) brings your files into Chest with their folders.
Today it takes:

- the `.zip` files that Google Drive (Google Takeout), Dropbox and Box give you
  when you download, or
- a folder on your computer, such as your Dropbox, Google Drive or Box Drive
  folder.

What arrives is every file and its folder tree. Sharing settings, shared links,
comments and earlier versions from those services are **not carried over yet**:
the files take the access of the place you put them in, so share them again in
Chest once they are in. Chest has no direct connection to those services yet, so
you download first, then move in.

## Get your files out

### Google Drive

1. Go to [takeout.google.com](https://takeout.google.com) and sign in.
2. Choose **Deselect all**, then tick **Drive** only. To take only some folders,
   choose **All Drive data included** and pick them.
3. Choose **Next step**: **Export once**, file type **.zip**, and the largest file
   size offered.
4. Choose **Create export**. Google emails you when it is ready; download every
   `.zip` it lists.

Google Docs, Sheets and Slides arrive as Word, Excel and PowerPoint files.
Takeout includes what is in My Drive, not shared drives or files other people own.
In Chest the files arrive in a folder named **Google Drive**.

### Dropbox

1. Go to [dropbox.com](https://www.dropbox.com) and open **All files**.
2. Tick the folders you want, or open a folder, then choose **Download**.
3. Dropbox gives you a `.zip`. Each download must be under 250 GB and fewer than
   10,000 files, so take big folders one at a time.

With the Dropbox desktop app you can instead choose its folder on your computer.

### Box

1. Go to [app.box.com](https://app.box.com) and open **All Files**.
2. Tick the folders you want, then choose **Download**.
3. Box gives you a `.zip`. Box refuses very large downloads (about 15 GB), so take
   big folders one at a time.

With Box Drive you can instead choose its folder on your computer.

## Bring them in

1. Open **Move in**.
2. Under **Put them in**, choose **My files**, a team space or a folder you can
   add to.
3. Choose **The .zip files you downloaded** (you can pick several Takeout parts at
   once), or **A folder on this computer**.
4. Choose **Start move-in**.

Chest makes each folder, then uploads each file with the same checked upload as
any other, showing the progress, what was added, what was skipped and anything
it could not take. Leave the page open while it runs. If it stops (a closed tab,
a lost connection, or **Stop**), choose the same files and start again: files
already there are skipped and a half-sent file carries on where it was.

Chest skips a file whose name is already taken in that folder, and empty
files. It keeps a file in a folder of the same name that is already there, so a
second move-in merges into the first. A file damaged inside the zip, or one
compressed in a way Chest cannot read, is listed under **Not added**; unzip the
download on your computer and choose the folder instead.

## The Library's archive move-in

The Library (records with sign-off) has its own importer, for the owner, under
**Move in › Library archive move-in**. It reads one JSON file in the documented
`chest-archive-1` format ([ARCHIVE.md](https://github.com/just-every/run-chest/blob/main/ARCHIVE.md)),
previews every item before anything is written, and files each record private
and unapproved. Use it only when you are moving records that need an owner, a
reviewer and an approved version.
