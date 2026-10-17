Chest reads what is inside your files, so search finds the words in them. It
reads in the background: an upload never waits for it, and the file's page
shows how far it has got.

## What Chest reads

- **PDFs with text** (most PDFs made on a computer): Chest reads the text
  itself. No key and no outside service are needed.
- **Word, Excel and PowerPoint files**, and their OpenDocument cousins: Chest
  reads their text itself.
- **Scans and photos**: scanned PDFs, and JPEG, PNG, WebP, GIF and HEIC photos
  (an iPhone's default). These are read by an AI model with your own key.
- **Plain text files**: read as they are.

On a file's page, **Text inside** says how many characters are searchable and
how they were read. **Read the text** shows them. For a photo it also shows the
picture the model read.

Chest reads up to 60 scanned pages and keeps up to 900,000 characters per
file; anything past that is named on the page. Encrypted PDFs and TIFF images
are not read yet, and the page says so.

## Add a key for scans

Only the owner can add the key, on **People & settings**, in the
**Reading scans** card.

1. Create an API key with your AI provider. For Anthropic, open
   console.anthropic.com, then API keys, then Create Key. Any provider with an
   OpenAI-compatible Chat Completions endpoint that reads images also works;
   choose OpenAI-compatible and enter its endpoint under More settings.
2. Paste the key, check the model name and choose **Save the key**.
3. Choose **Test the key**. Chest sends one made-up line of text, never a file,
   and shows what the model read back.

Chest keeps the key sealed and never shows it again. Exports never include it:
after a restore, add it again. Files that waited for a key are read as soon as
you save one.

Each scanned page or photo is sent to your provider as an image, and your
provider bills you for it. Text inside a document is treated as data, never as
an instruction to the model.

On RER Managed hosting, reading scans is not available yet: Managed has no
outbound connection for AI providers. PDF and Office text is still read there.

## Search

Search covers file names and the words inside, with a short extract around the
match. It only shows files you can open now: when someone loses access, their
next search no longer finds the file or its words. The same holds in the
Library for records.

## Fields read from a scan

When a scanned record in the Library has a document type with fields (for
example an NDA with Party, Effective date and Term), Chest reads those fields
from the scan. The record's page shows each page with a numbered box around
the words each value came from, its page and how sure the model is.

Nothing is saved until an editor of the record says yes:

- **Accept** saves the value as read.
- **Correct** saves the value you type instead.
- **Reject** saves nothing.

A value someone already saved is never replaced: the reading is shown beside
it. A field the model could not read is shown as not readable and left empty.
Readers see the values and the boxes, but not the buttons. Each accept,
correction and rejection is in the audit trail with the version, page, box and
the model that read it. A new version is read again; earlier decisions stay
with their own version.
