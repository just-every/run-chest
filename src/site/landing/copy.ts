// Every line of the homepage's copy, exactly as the owner accepted it on the desk (desk-chest/README.md and
// page-01 … page-09). CLAIMS.md in the evidence folder maps each capability claim to the code that backs it.

export const heroCopy = {
  sub: 'Chest stores, syncs and shares your team’s files,\nreads every scan, and quietly files what arrives.',
  /** The hosted demo (deploy-demo.json, DEMO.md). */
  demo: 'https://demo.run-chest.com/',
}

export const featureCopy = {
  sync: { eyebrow: 'Sync', ink: 'On every\n', grad: 'desk and phone.', lead: 'Files stay in sync on Mac, Windows, iPhone and Android,\nand open on demand without filling your disk.' },
  sharing: { eyebrow: 'Sharing', ink: 'Share\n', grad: 'without worry.', lead: 'Links with a password, an expiry and a download limit.\nRevoke any link in one click, or ask anyone to upload\nwith a file request.' },
  search: { eyebrow: 'Search', ink: 'Find the sentence,\n', grad: 'not just the file.', lead: 'Chest reads every document and scan, so search\nfinds the words inside, and only shows what you\nare allowed to see.' },
  together: { eyebrow: 'Work together', ink: 'Open it and\n', grad: 'edit together.', lead: 'Word, Excel and PowerPoint files open right\nin the browser. Edit at the same time, comment,\nand keep one copy.' },
  versions: { eyebrow: 'Versions', ink: 'Every', grad: 'version,\nkept.', lead: 'Go back to any earlier version of a file or a whole\nfolder, and see who changed what. Approvals stay\nwith the exact version signed off.' },
  agents: { eyebrow: 'Agents', ink: 'Files that\n', grad: 'file themselves.', lead: 'Agents file what arrives from email and apps,\nmerge duplicates, and flag links shared too widely.' },
  moveIn: { eyebrow: 'Move in', ink: 'Bring', grad: 'everything\nwith you.', lead: 'Move from Google Drive, Dropbox or Box with\nfolders, permissions, versions and shared links.\nOld links forward to the new ones.' },
  teams: { eyebrow: 'For teams', ink: 'Your team,\n', grad: 'your rules.', lead: 'Single sign-on, automatic user setup,\nteam spaces and storage limits, all in one place.' },
  ownership: { eyebrow: 'Ownership', ink: 'Yours,\n', grad: 'start to finish.', lead: 'Run Chest on your own computer or server\nand keep every file. Export everything, any time.' },
} as const

export const ownershipList = ['Your own storage', 'Your own computer or server', 'Export any time'] as const

export const details = [
  { icon: 'fileCheck', tone: 'lilac', title: 'Exact-version approvals', body: 'Sign-off sticks to the version that was approved.', mark: 'ticks' },
  { icon: 'upload', tone: 'sky', title: 'File requests', body: 'Anyone can upload to the folder you choose.', mark: 'curl' },
  { icon: 'cloudUp', tone: 'peach', title: 'Large files', body: 'Big uploads resume where they stopped.', mark: 'ticks' },
  { icon: 'trash', tone: 'sky', title: 'Trash you can undo', body: 'Deleted files come back for 30 days.', mark: 'undo' },
  { icon: 'eye', tone: 'lilac', title: 'Previews', body: 'Documents, video and design files open in the browser.', mark: 'ticks' },
  { icon: 'list', tone: 'peach', title: 'Activity log', body: 'Every view, share and change, recorded.', mark: 'ticks' },
] as const

export const closingCopy = { line: 'Open source file storage for your whole team.', licence: 'Free and open source, MIT licensed.' }
