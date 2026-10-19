// Every line of the homepage's copy, as the owner accepted it on the desk (desk-chest/README.md and page-s1/
// page-01 … page-11), with the build's fixes from page-s1/BUILD-NOTES.md. docs/CLAIMS.md maps each capability
// claim to the code that backs it. A "\n" is the desk's line break on wide screens and a space on phones.

export const heroCopy = {
  sub: 'Chest stores, syncs and shares your team’s files,\nreads every scan, and quietly files what arrives.',
  /** The hosted demo (deploy-demo.json, DEMO.md). */
  demo: 'https://demo.run-chest.com/',
}

export type SectionCopy = { eyebrow: string; ink: string; grad: string; lead: string }

/** One supplier's folder, Sat Sep 26 to the renewal: each section's date eyebrow, two-tone heading and lead. */
export const sectionCopy = {
  moveIn: { eyebrow: 'Sat, Sep 26 · Move in', ink: 'Bring everything\n', grad: 'with you.', lead: 'Move from Dropbox, Google Drive or Box. Folders,\npermissions, versions and shared links come across.' },
  folder: { eyebrow: 'One supplier, end to end', ink: 'Follow ', grad: 'one folder.', lead: 'Acme Supply joined in October. Everything about them lives here.' },
  arrivals: { eyebrow: 'Fri, Oct 2 · Arrivals', ink: 'Files that\n', grad: 'file themselves.', lead: 'The Chest agent reads what arrives\nby email and from apps, names it,\nfiles it and closes links shared\ntoo widely.' },
  road: { eyebrow: 'Fri, Oct 9 · On the road', ink: 'On every desk\n', grad: 'and phone.', lead: 'Files open on demand on Mac and\nWindows, photos upload from the\nphone, and edits made offline come\nhome safely.' },
  pricing: { eyebrow: 'Wed, Oct 14 · Pricing', ink: 'Open it and\n', grad: 'edit together.', lead: 'Word, Excel and PowerPoint files\nopen in the browser. Edit at the\nsame time, comment, and keep\none copy.' },
  shareOut: { eyebrow: 'Tue, Oct 20 · Contract out', ink: 'Share out. ', grad: 'Collect in.', lead: 'Send a link with a password and an expiry, and ask for files back without an account.' },
  signOff: { eyebrow: 'Wed, Oct 28 · Sign-off', ink: 'Every version,\n', grad: 'kept.', lead: 'Restore any earlier version in one click.\nA sign-off stays with the exact version\nthat was approved.' },
  closeOut: { eyebrow: 'Mon, Nov 30 · Close out', ink: 'The right version ', grad: 'reached everyone.', lead: 'The agent checks that everyone has the signed version, and that nothing is left open.' },
  renewal: { eyebrow: 'Oct 2027 · Renewal', ink: 'Find the sentence\n', grad: 'inside the file.', lead: 'Chest reads every document and scan,\nso search finds the words inside, and\nonly shows what you are allowed to see.' },
} satisfies Record<string, SectionCopy>

export const closingCopy = {
  limitsTitle: 'Not in Chest yet.',
  limits: 'No Linux desktop app, and no editor for CAD, video or design files.',
  line: 'Open source file storage for your whole team.',
  licence: 'Free and open source, MIT licensed.',
}
