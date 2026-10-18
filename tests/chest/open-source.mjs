// OPEN-001: the real source exporter and production Worker public doors.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtemp, mkdir, readFile, readdir, lstat, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {load} from 'js-yaml';
import {publicExport} from '@runeditrun/rer/modules/release/export';
import {licenseInventory, thirdPartyLicenses} from '../../scripts/third-party-licenses.mjs';
import {harness} from './harness.mjs';

const root = process.cwd();
const chargeGate = /\b(?:(?:license|licence)[_ -]?key|seat[_ -]?(?:cap|limit)|user[_-]?cap|max[_-]?(?:users|seats)|paywall|payment[_-]?required|require[_-]?payment|paid[_-]?feature|premium[_-]?only|feature[_ -]?lock|(?:require|assert|validate|check)[_-]?(?:paidPlan|subscription|license|licence))\b/i;
async function scan(directory) {
  for (const entry of await readdir(directory, {withFileTypes: true})) {
    const file = join(directory, entry.name);
    if (entry.isDirectory()) await scan(file);
    else if (/\.(?:[cm]?js|[cm]?tsx?|json|html)$/.test(entry.name))
      assert.ok(!chargeGate.test(await readFile(file, 'utf8')), `Unexpected charge gate in ${file}`);
  }
}

async function releaseArtifact() {
  await thirdPartyLicenses(root, {check: true});
  // The exporter consumes ordinary source bytes, never node_modules or local
  // state. Snapshot the current candidate so this also works before its commit;
  // RER's release command separately requires a clean committed checkout.
  const names = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], {cwd: root})
    .toString().split('\0').filter(Boolean);
  const entries = new Map(), contents = new Map();
  for (const name of new Set(names)) {
    const stat = await lstat(join(root, name));
    assert.ok(stat.isFile(), `Source export requires an ordinary file: ${name}`);
    entries.set(name, {type: 'blob', mode: stat.mode & 0o111 ? '100755' : '100644'});
    contents.set(name, await readFile(join(root, name)));
  }
  const directory = await mkdtemp(join(tmpdir(), 'chest-open-release-'));
  try {
    const output = join(directory, 'artifacts'), consumer = join(directory, 'fresh-source');
    await Promise.all([mkdir(output), mkdir(consumer)]);
    const artifact = publicExport({entries, bytes: name => contents.get(name), commit: 'candidate-source'}, directory, output);
    execFileSync('tar', ['-xf', join(output, artifact.path), '-C', consumer], {stdio: 'pipe'});
    const license = await readFile(join(consumer, 'LICENSE'), 'utf8');
    assert.equal(license, contents.get('LICENSE').toString());
    assert.match(license, /^MIT License\n/);
    assert.match(license, /Permission is hereby granted, free of charge/);
    assert.match(license, /THE SOFTWARE IS PROVIDED "AS IS"/);
    const notices = await readFile(join(consumer, 'THIRD-PARTY-LICENSES.md'), 'utf8');
    assert.equal(notices, contents.get('THIRD-PARTY-LICENSES.md').toString());
    // Independently walk the archived lock's graph, rather than compare a pinned
    // package count or a list that silently becomes incomplete as dependencies grow.
    const lock = load(await readFile(join(consumer, 'pnpm-lock.yaml'), 'utf8'));
    const pending = Object.entries({...lock.importers['.'].dependencies, ...lock.importers['.'].optionalDependencies})
      .map(([name, entry]) => [name, entry.version]);
    const snapshots = new Set(), expected = new Set();
    while (pending.length) {
      const [name, reference] = pending.pop();
      const key = Object.hasOwn(lock.snapshots, `${name}@${reference}`) ? `${name}@${reference}` : reference;
      if (snapshots.has(key)) continue;
      snapshots.add(key); expected.add(key.split('(')[0]);
      const snapshot = lock.snapshots[key];
      assert.ok(snapshot, `Archived lock has no snapshot for ${name}`);
      pending.push(...Object.entries({...snapshot.dependencies, ...snapshot.optionalDependencies}));
    }
    const inventory = licenseInventory(notices);
    assert.deepEqual(new Set(inventory.keys()), expected, 'The source release covers the entire production closure');
    for (const [id, entry] of inventory) {
      assert.ok(entry.license && entry.license !== 'UNKNOWN', `Declared dependency license: ${id}`);
      assert.equal(entry.integrity, lock.packages[id].resolution.integrity, `Exact dependency distribution: ${id}`);
    }
    for (const source of [root, consumer])
      for (const folder of ['src', 'public', 'scripts/installer']) await scan(join(source, folder));
  } finally { await rm(directory, {recursive: true, force: true}); }
}

await releaseArtifact();
const h = await harness();
try {
  assert.equal((await h.raw('/auth/bootstrap', null, {token: h.vars.SETUP_TOKEN, displayName: 'Owner'})).status, 303);
  const owner = await h.signIn(h.vars.OWNER_EMAIL);
  assert.equal((await h.fetch('/setup', {method: 'POST', headers: {cookie: owner, origin: h.origin,
    'content-type': 'application/x-www-form-urlencoded'}, body: 'confirm=yes'})).status, 303);
  const emails = Array.from({length: 150}, (_, index) => `staff-${index + 1}@example.test`);
  for (const [index, email] of emails.entries()) {
    // Cloudflare's trusted edge supplies these source addresses. Onboarding from
    // several admin networks respects the genuine per-IP mail abuse protection;
    // no auth/storage limits are disabled and no identities are inserted by SQL.
    const response = await h.fetch('/api/chest/people', {method: 'POST', headers: {
      cookie: owner, origin: h.origin, 'content-type': 'application/json',
      'CF-Connecting-IP': `198.51.100.${1 + Math.floor(index / 25)}`},
    body: JSON.stringify({action: 'invite', email, name: `Staff ${index + 1}`})});
    assert.equal(response.status, 200, `Invitation ${index + 1} succeeds`);
    assert.equal((await response.json()).invited, true);
  }
  const people = (await h.api('/library', owner)).people;
  assert.equal(people.filter(person => emails.includes(person.id)).length, emails.length);
  for (const email of emails) assert.ok(h.mails.some(mail => [mail.to].flat().includes(email)), 'Each invitation reaches the mail-provider edge');
  const staff = await h.signIn(emails.at(-1), true), first = await h.signIn(emails[0], true);
  const personal = (await h.api('/files', staff)).personal, original = 'Open source staff 150 search proof';
  const file = await h.api('/items', staff, {space: personal, name: 'Staff 150.txt', base64: Buffer.from(original).toString('base64')});
  // The ordinary browser form action shares the last staff member's original.
  const form = new FormData();
  for (const [name, value] of Object.entries({path: `/items/${file.id}/shares`, returnTo: `/app/items/${file.id}`,
    principal: emails[0], role: 'viewer'})) form.set(name, value);
  assert.equal((await h.fetch('/app/action', {method: 'POST', headers: {cookie: staff, origin: h.origin}, body: form})).status, 303);
  assert.equal((await h.api('/search?q=' + encodeURIComponent(original), staff)).results[0].id, file.id);
  assert.equal((await h.api('/search?q=' + encodeURIComponent(original), first)).results[0].id, file.id);
  const downloaded = await h.raw(`/api/chest/items/${file.id}/bytes/${file.payload.current}?download=true`, first);
  assert.equal(downloaded.status, 200); assert.equal(await downloaded.text(), original);
  // A real device credential exercises the public transport used by delivered
  // sync functionality; native clients remain in their own incomplete clauses.
  const device = await h.api('/devices', staff, {name: 'Staff 150 device', platform: 'macos'});
  const sync = await h.fetch('/api/chest/sync/tree', {headers: {authorization: `Bearer ${device.token}`}});
  assert.equal(sync.status, 200); assert.ok((await sync.json()).items.some(item => item.id === file.id));
  for (const [path, cookie] of [['/app/admin', owner], ['/app/files', staff], [`/app/items/${file.id}`, staff],
    ['/app/files/search?q=' + encodeURIComponent(original), staff]]) {
    const response = await h.raw(path, cookie);
    assert.equal(response.status, 200); assert.ok(!chargeGate.test(await response.text()), 'Rendered product has no charge prompt');
  }
  console.log('OPEN-001 source release licenses, computed dependency coverage and 150-staff upload/share/search/device access passed');
} finally { await h.close(); }
