import assert from 'node:assert/strict';
import {readFile, readdir, writeFile} from 'node:fs/promises';
import {join, resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {load} from 'js-yaml';

const filename = 'THIRD-PARTY-LICENSES.md';
const identity = key => key.split('(')[0];
const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;
const expression = manifest => {
  const value = manifest.license;
  const license = typeof value === 'string' ? value : value?.type;
  assert.ok(license && !/[|\r\n`]/.test(license), `Missing or invalid license: ${manifest.name}@${manifest.version}`);
  return license;
};

// Traverse the production importer, including peer-resolved snapshots, aliases
// and optional dependencies. Dev-only roots are deliberately not starting points.
export function productionDependencies(lock) {
  assert.equal(String(lock.lockfileVersion), '9.0', 'Unsupported pnpm lockfile format');
  const snapshots = new Map(), packages = new Map();
  function visit(name, reference, optional) {
    const key = lock.snapshots?.[`${name}@${reference}`] ? `${name}@${reference}` : reference;
    const snapshot = lock.snapshots?.[key];
    assert.ok(snapshot, `Missing locked snapshot: ${name}@${reference}`);
    if (snapshots.has(key) && (optional || !snapshots.get(key))) return;
    snapshots.set(key, optional);
    const id = identity(key), separator = id.lastIndexOf('@');
    const metadata = lock.packages?.[id];
    assert.ok(separator > 0 && metadata?.resolution?.integrity, `Missing locked package integrity: ${id}`);
    const previous = packages.get(id);
    packages.set(id, {id, name: id.slice(0, separator), version: id.slice(separator + 1),
      integrity: metadata.resolution.integrity, optional: optional && previous?.optional !== false});
    for (const [n, v] of Object.entries(snapshot.dependencies ?? {})) visit(n, v, optional);
    for (const [n, v] of Object.entries(snapshot.optionalDependencies ?? {})) visit(n, v, true);
  }
  const importer = lock.importers?.['.'];
  assert.ok(importer?.dependencies, 'Missing production importer');
  for (const [name, entry] of Object.entries(importer.dependencies)) visit(name, entry.version, false);
  for (const [name, entry] of Object.entries(importer.optionalDependencies ?? {})) visit(name, entry.version, true);
  return [...packages.values()].sort((a, b) => compare(a.id, b.id));
}

export function licenseInventory(markdown) {
  const result = new Map();
  for (const line of markdown.split('\n')) {
    const row = /^\| `([^`]+)` \| ([^|]+) \| `([^`]+)` \|$/.exec(line);
    if (!row) continue;
    assert.ok(!result.has(row[1]), `Duplicate license entry: ${row[1]}`);
    result.set(row[1], {license: row[2].trim(), integrity: row[3]});
  }
  return result;
}

async function installedManifest(root, dependency, directories) {
  const prefix = dependency.name.replace('/', '+') + '@' + dependency.version;
  for (const directory of directories.filter(d => d === prefix || d.startsWith(prefix + '_'))) {
    try {
      const manifest = JSON.parse(await readFile(join(root, 'node_modules/.pnpm', directory, 'node_modules', dependency.name, 'package.json'), 'utf8'));
      assert.equal(manifest.name, dependency.name);
      assert.equal(manifest.version, dependency.version);
      return manifest;
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  return null;
}

// A source release supports every locked platform. pnpm does not install the
// other platforms' native binaries, so generation reads their published package
// manifests and verifies the tarball identity against the lock. Checks are
// offline: only absent optional packages may reuse recorded, integrity-bound data.
export async function thirdPartyLicenses(root, {check = false} = {}) {
  const lock = load(await readFile(join(root, 'pnpm-lock.yaml'), 'utf8'));
  const dependencies = productionDependencies(lock);
  const directories = await readdir(join(root, 'node_modules/.pnpm'));
  let previous = '';
  try { previous = await readFile(join(root, filename), 'utf8'); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  const recorded = licenseInventory(previous), rows = [];
  async function record(dependency) {
    let manifest = await installedManifest(root, dependency, directories), license;
    if (manifest) license = expression(manifest);
    else {
      assert.ok(dependency.optional, `Install the locked production dependency: ${dependency.id}`);
      if (check) {
        const entry = recorded.get(dependency.id);
        assert.equal(entry?.integrity, dependency.integrity, `Regenerate licenses for optional package: ${dependency.id}`);
        assert.ok(entry.license && entry.license !== 'UNKNOWN', `Missing optional license: ${dependency.id}`);
        license = entry.license;
      } else {
        const url = `https://registry.npmjs.org/${encodeURIComponent(dependency.name)}/${encodeURIComponent(dependency.version)}`;
        const response = await fetch(url, {signal: AbortSignal.timeout(30_000)});
        assert.ok(response.ok, `Cannot read published optional metadata: ${dependency.id}`);
        manifest = await response.json();
        assert.equal(manifest.name, dependency.name);
        assert.equal(manifest.version, dependency.version);
        assert.equal(manifest.dist?.integrity, dependency.integrity, `Published package differs from lock: ${dependency.id}`);
        license = expression(manifest);
      }
    }
    return `| \`${dependency.id}\` | ${license} | \`${dependency.integrity}\` |`;
  }
  for (let offset = 0; offset < dependencies.length; offset += 4)
    rows.push(...await Promise.all(dependencies.slice(offset, offset + 4).map(record)));
  const markdown = `# Third-party licenses

Generated by \`node scripts/third-party-licenses.mjs\` from \`pnpm-lock.yaml\` and installed package manifests. Do not edit this list by hand.

Chest's own source is MIT licensed; see [LICENSE](LICENSE). Dependencies retain their own licenses, including LGPL components. A dependency's license applies independently of Chest's MIT license.

This inventory covers all ${dependencies.length} package versions reachable from the production importer, including transitive dependencies, resolved peers, aliases and optional platform packages. Development-only roots are excluded. Native packages for other platforms use published npm manifests whose tarball integrity matches the lock. The integrity column binds every entry to that exact locked distribution.

Run \`node scripts/third-party-licenses.mjs --check\` after a frozen install to check coverage and installed licenses without network access. Regeneration reads npm metadata for optional packages absent on this platform; failure or missing metadata stops generation. Package distributions contain their full license texts and notices; this inventory records their declared licenses.

| Package version | Declared license | Locked distribution integrity |
| --- | --- | --- |
${rows.join('\n')}
`;
  if (check) assert.equal(previous, markdown, `Stale ${filename}; run node scripts/third-party-licenses.mjs`);
  return markdown;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  assert.ok(process.argv.slice(2).every(arg => arg === '--check'), 'Usage: node scripts/third-party-licenses.mjs [--check]');
  const check = process.argv.includes('--check'), root = process.cwd();
  const markdown = await thirdPartyLicenses(root, {check});
  if (!check) await writeFile(join(root, filename), markdown);
  console.log(`${filename}: ${licenseInventory(markdown).size} production package licenses ${check ? 'checked' : 'generated'}`);
}
