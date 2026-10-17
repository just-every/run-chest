// Move in: bring a folder from this computer, or the .zip files Google Takeout, Dropbox and Box give you, into a
// Chest space or folder with their folder tree. Folders are made through the ordinary folder API and each file goes
// up through the same resumable upload as a dropped file, so Chest checks every byte. Running the same move-in again
// skips what already arrived and continues files that were part-way through.
(() => {
  const panel = document.querySelector('[data-movein]')
  if (!panel || !window.fetch || !window.ChestZip || !window.DecompressionStream) return
  panel.hidden = false
  for (const note of document.querySelectorAll('[data-movein-needs-script]')) note.hidden = true
  const $ = s => panel.querySelector(s)
  const size = n => n < 1048576 ? `${Math.max(1, Math.round(n / 1024))} KB` : n < 1073741824 ? `${(n / 1048576).toFixed(1)} MB` : `${(n / 1073741824).toFixed(2)} GB`
  const wait = ms => new Promise(r => setTimeout(r, ms))
  const problems = {
    invalid_name: 'Chest cannot use this name.', file_too_large: 'Larger than 4 GB, the most Chest takes in one file.', contribute_refused: 'You cannot add files there.',
    access_required: 'You cannot add files there.', checksum_mismatch: 'The bytes Chest received did not match. Nothing was saved.', upload_expired: 'Left unfinished too long. Run the move-in again.',
    not_zip: 'This is not a .zip file Chest can read.', encrypted: 'This file is password-protected inside the zip.', method: 'This file is compressed in a way Chest cannot read yet (unzip the archive on your computer and choose the folder instead).',
    crc: 'This file is damaged inside the zip, so it was not kept.',
  }
  class Refused extends Error { constructor(code) { super(code); this.code = code } }
  async function api(method, path, body) {
    let r
    try { r = await fetch('/api/chest' + path, { method, headers: body ? { 'content-type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined, credentials: 'same-origin' }) } catch { throw new Error('offline') }
    const data = await r.json().catch(() => ({}))
    if (r.status >= 500) throw new Error('server')
    if (!r.ok) throw new Refused(data.error || `http_${r.status}`)
    return data
  }
  // Network trouble is retried with backoff until it works or the person stops; a refusal is final.
  let stopped = false
  async function patiently(step) {
    for (let attempt = 0; ; attempt++) {
      if (stopped) throw new Refused('stopped')
      try { return await step() } catch (e) {
        if (e instanceof Refused || e instanceof ChestZip.ZipProblem) throw e
        $('[data-state]').textContent = 'Connection lost · carries on by itself'
        await Promise.race([wait(Math.min(30000, 1000 * 2 ** attempt)), new Promise(r => addEventListener('online', r, { once: true }))])
      }
    }
  }
  // What to bring in: every file and folder with its path. A Takeout download keeps only its Drive part, under a
  // "Google Drive" folder; Dropbox and Box zips already start with the folder that was downloaded.
  const junk = p => /(^|\/)(__MACOSX|\.DS_Store|Thumbs\.db|desktop\.ini)(\/|$)/.test(p)
  async function plan(zips, picked) {
    const items = []
    for (const file of zips) {
      let list
      try { list = await ChestZip.entries(file) } catch (e) { items.push({ path: file.name, problem: e instanceof ChestZip.ZipProblem ? e.message : 'not_zip' }); continue }
      const takeout = list.some(e => /^Takeout\/[^/]*Drive[^/]*\//.test(e.name))
      for (const e of list) {
        let path = e.name.replace(/^\/+/, '').replace(/\/+$/, '')
        if (!path || junk(path)) continue
        if (takeout) { const m = /^Takeout\/[^/]*Drive[^/]*\/(.+)$/.exec(path); if (!m) continue; path = `Google Drive/${m[1]}` }
        items.push(e.folder ? { path, folder: true } : { path, size: e.size, modified: e.modified, open: () => ChestZip.open(file, e) })
      }
    }
    for (const file of picked) {
      const path = file.webkitRelativePath || file.name
      if (junk(path)) continue
      items.push({ path, size: file.size, modified: file.lastModified, open: async () => ({ stream: file.stream(), check: () => {} }) })
    }
    return items
  }
  // Folders: made once each, or reused when one of that name is already there.
  const folders = new Map(), listed = new Map()
  async function folder(target, path, counts) {
    if (!path) return target
    if (folders.has(path)) return folders.get(path)
    const cut = path.lastIndexOf('/'), parent = await folder(target, path.slice(0, cut > 0 ? cut : 0), counts), name = path.slice(cut + 1)
    const made = await patiently(async () => {
      try { counts.folders++; return (await api('POST', '/items', { ...parent, type: 'folder', name })).id }
      catch (e) {
        counts.folders--
        if (!(e instanceof Refused) || e.code !== 'name_taken') throw e
        const key = parent.parent ?? `space:${parent.space}`
        if (!listed.has(key)) listed.set(key, (await api('GET', parent.parent ? `/items/${parent.parent}` : `/spaces/${parent.space}`)).children)
        const found = listed.get(key).find(c => c.name === name && c.type === 'folder')
        if (!found) throw new Refused('name_taken')
        return found.id
      }
    })
    const place = { parent: made }
    folders.set(path, place)
    return place
  }
  // One file: open (or reopen) its upload session, send the parts Chest does not hold yet, check the zip's CRC, finish.
  async function send(place, item, name, show) {
    const u = await patiently(() => api('POST', '/uploads', { ...place, name, size: item.size, lastModified: item.modified }))
    const have = new Set(u.parts), source = await item.open(), reader = source.stream.getReader()
    let n = 1, buffered = [], length = 0, sent = 0
    const flush = async last => {
      while (length >= u.partSize || (last && length > 0)) {
        const all = new Blob(buffered), take = Math.min(u.partSize, length), blob = all.slice(0, take), rest = all.slice(take)
        buffered = rest.size ? [new Uint8Array(await rest.arrayBuffer())] : []; length -= take
        if (!have.has(n)) await patiently(async () => { const r = await fetch(`/api/chest/uploads/${u.id}/parts/${n}`, { method: 'PUT', headers: { 'content-type': 'application/octet-stream' }, body: blob, credentials: 'same-origin' }).catch(() => { throw new Error('offline') }); if (r.status >= 500) throw new Error('server'); if (!r.ok) throw new Refused((await r.json().catch(() => ({}))).error || `http_${r.status}`) })
        sent += take; n++; show(sent)
      }
    }
    for (;;) {
      if (stopped) { await reader.cancel(); throw new Refused('stopped') }
      const { done, value } = await reader.read()
      if (done) break
      buffered.push(value); length += value.length
      if (length >= u.partSize) await flush(false)
    }
    await flush(true)
    try { source.check() } catch (e) { await api('POST', `/uploads/${u.id}/cancel`, {}).catch(() => {}); throw e }
    await patiently(() => api('POST', `/uploads/${u.id}/complete`, {}))
  }
  function line(list, text) { const li = document.createElement('li'); li.textContent = text; $(list).append(li); $(list).parentElement.hidden = false }
  $('[data-start]').onclick = async () => {
    const zips = [...$('[data-zips]').files], picked = [...$('[data-folder]').files], chosen = $('[data-destination]').value, kind = chosen.slice(0, chosen.indexOf(':')), id = chosen.slice(chosen.indexOf(':') + 1)
    if (!zips.length && !picked.length) { $('[data-state]').textContent = 'Choose your .zip files or a folder first.'; return }
    const target = kind === 'space' ? { space: id } : { parent: id }
    stopped = false; folders.clear(); listed.clear()
    for (const list of ['[data-skipped]', '[data-failed]']) { $(list).replaceChildren(); $(list).parentElement.hidden = true }
    $('[data-start]').disabled = true; $('[data-stop]').hidden = false; $('[data-report]').hidden = false
    const counts = { folders: 0, files: 0, skipped: 0, failed: 0 }
    const tally = () => { $('[data-counts]').textContent = `${counts.files} file(s) and ${counts.folders} folder(s) added · ${counts.skipped} already there · ${counts.failed} not added` }
    $('[data-state]').textContent = 'Reading what you chose'
    const items = await plan(zips, picked), files = items.filter(i => !i.folder && !i.problem), total = files.reduce((n, i) => n + i.size, 0)
    let done = 0
    tally()
    for (const item of items) {
      if (stopped) break
      const cut = item.path.lastIndexOf('/'), dir = item.folder ? item.path : item.path.slice(0, Math.max(cut, 0)), name = item.path.slice(cut + 1)
      try {
        if (item.problem) throw new ChestZip.ZipProblem(item.problem)
        const place = await folder(target, dir, counts)
        if (item.folder) continue
        if (!item.size) { counts.skipped++; line('[data-skipped]', `${item.path} (empty file; Chest keeps no empty files)`); continue }
        $('[data-state]').textContent = `Uploading ${item.path}`
        await send(place, item, name, sent => { $('[data-bar]').value = total ? Math.floor((done + sent) * 100 / total) : 100; $('[data-bytes]').textContent = `${size(done + sent)} of ${size(total)}` })
        counts.files++
      } catch (e) {
        if (e instanceof Refused && e.code === 'stopped') break
        if (e instanceof Refused && e.code === 'name_taken') { counts.skipped++; line('[data-skipped]', `${item.path} (a file of this name is already there)`) }
        else { counts.failed++; line('[data-failed]', `${item.path}: ${problems[e.code ?? e.message] || `Chest refused it (${e.code ?? e.message}).`}`) }
      }
      if (!item.folder && !item.problem) done += item.size
      tally()
    }
    $('[data-bar]').value = stopped ? $('[data-bar]').value : 100
    $('[data-state]').textContent = stopped ? 'Stopped. Choose the same files and start again to carry on.' : 'Move-in finished'
    $('[data-start]').disabled = false; $('[data-stop]').hidden = true
    $('[data-open]').href = kind === 'space' ? `/app/spaces/${encodeURIComponent(id)}` : `/app/items/${id}`; $('[data-open]').hidden = false
  }
  $('[data-stop]').onclick = () => { stopped = true; $('[data-state]').textContent = 'Stopping after this part' }
})()
