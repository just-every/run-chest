// Chest uploads in the browser: drop files on a folder page or choose them (on a phone, the picker also offers the
// camera). Each file goes up in parts with its progress shown; a lost connection retries by itself, and choosing the
// same file again after a reload continues from the parts Chest already holds. Without this script the plain upload
// form still works.
(() => {
  const panels = [...document.querySelectorAll('[data-upload]')]
  if (!panels.length || !window.fetch) return
  const problems = {
    name_taken: 'A file with this name is already here. Rename one of them and try again.',
    file_too_large: 'This file is larger than 4 GB, the most Chest takes in one file today.',
    suspect_upload_held: 'This upload source was paused. Suspect bytes were held before publication. Open Upload protection from Files to review and resume.',
    incident_downloads_paused: 'Downloads in this affected folder are paused. Open Upload protection from Files.',
    storage_limit_exceeded: 'This space has reached its storage limit. Ask the owner to raise the limit or permanently erase retained files.',
    invalid_size: 'Empty files cannot be uploaded.',
    invalid_name: 'This name cannot be used for a file.',
    contribute_refused: 'You cannot add files here.',
    access_required: 'You cannot add files here.',
    checksum_mismatch: 'The bytes Chest received do not match this file. Nothing was saved.',
    upload_expired: 'This upload was left unfinished for too long. Choose the file again to start over.',
  }
  const size = n => n < 1024 ? `${n} bytes` : n < 1048576 ? `${(n / 1024).toFixed(1)} KB` : n < 1073741824 ? `${(n / 1048576).toFixed(1)} MB` : `${(n / 1073741824).toFixed(2)} GB`
  const wait = ms => new Promise(r => setTimeout(r, ms))
  const clock = s => s < 60 ? `${s} s` : `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, '0')} s`
  // Checking every byte reads the whole file through twice on the server, one request with no progress of its own.
  // Measured locally at 17 to 22 MB a second (1 GB took about 60 s), so the estimate uses the slower figure.
  const CHECK_RATE = 16 * 1048576
  class Refused extends Error { constructor(code, detail) { super(code); this.code = code; this.detail = detail } }
  async function api(method, path, body) {
    let response
    try { response = await fetch('/api/chest' + path, { method, headers: body ? { 'content-type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined, credentials: 'same-origin' }) }
    catch { throw new Error('offline') }
    const data = await response.json().catch(() => ({}))
    if (response.status >= 500) throw new Error('server')
    if (!response.ok) throw new Refused(data.error || `http_${response.status}`, data)
    return data
  }
  // One part with upload progress; resolves when Chest has recorded it.
  function put(job, n, blob) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest(); job.xhr = xhr
      xhr.open('PUT', `/api/chest/uploads/${job.id}/parts/${n}`)
      xhr.setRequestHeader('content-type', 'application/octet-stream')
      xhr.upload.onprogress = e => { job.inflight = e.loaded; draw(job) }
      xhr.onload = () => { job.xhr = null; job.inflight = 0; if (xhr.status === 200) resolve(JSON.parse(xhr.responseText)); else if (xhr.status >= 500) reject(new Error('server')); else { let code = `http_${xhr.status}`; try { code = JSON.parse(xhr.responseText).error || code } catch {} reject(new Refused(code)) } }
      xhr.onerror = () => { job.xhr = null; job.inflight = 0; reject(new Error('offline')) }
      xhr.onabort = () => { job.xhr = null; job.inflight = 0; reject(new Error('paused')) }
      xhr.send(blob)
    })
  }
  function draw(job) {
    const total = job.file.size, got = Math.min(total, job.received + (job.inflight || 0)), pct = total ? Math.floor(got * 100 / total) : 0
    const label = { waiting: 'Waiting', starting: 'Starting', uploading: `Uploading ${pct}%`, paused: `Paused at ${pct}%`, retrying: `Connection lost at ${pct}% · resumes by itself`, verifying: 'Checking every byte', done: 'Uploaded', failed: 'Not uploaded', cancelled: 'Cancelled' }[job.state]
    job.row.dataset.state = job.state
    job.status.textContent = label
    if (job.state === 'verifying') {
      job.checking ??= { since: Date.now(), tick: setInterval(() => draw(job), 1000) }
      job.bar.removeAttribute('value')
      job.bytes.textContent = `${clock(Math.round((Date.now() - job.checking.since) / 1000))} so far · up to about ${clock(Math.max(1, Math.round(total / CHECK_RATE)))} for ${size(total)}`
    } else {
      if (job.checking) { clearInterval(job.checking.tick); job.checking = null }
      job.bar.value = job.state === 'done' ? 100 : pct
      job.bytes.textContent = job.state === 'done' ? `${size(total)} · SHA-256 ${job.checksum.slice(0, 6)}…${job.checksum.slice(-7)}` : `${size(got)} of ${size(total)}`
    }
    job.pause.hidden = !['uploading', 'retrying', 'paused'].includes(job.state)
    job.pause.textContent = job.state === 'paused' ? 'Resume' : 'Pause'
    job.cancel.hidden = ['done', 'failed', 'cancelled', 'verifying'].includes(job.state)
  }
  // A resumed upload shows its live progress only: its line under Unfinished uploads goes, and the list with its last.
  function resumed(job) {
    const panel = job.row.closest('[data-upload]'), line = panel.querySelector(`[data-waiting="${CSS.escape(job.id)}"]`)
    for (const summary of document.querySelectorAll(`[data-upload-summary="${CSS.escape(job.id)}"]`)) {
      const section = summary.closest('section'); summary.remove()
      if (section && !section.querySelector('[data-upload-summary]')) section.remove()
    }
    if (!line) return
    line.remove()
    const waiting = panel.querySelector('.upload-waiting')
    if (waiting && !waiting.querySelector('[data-waiting]')) waiting.remove()
  }
  async function send(job) {
    job.state = 'starting'; job.problem.textContent = ''; draw(job)
    for (let attempt = 0; ; attempt++) {
      try {
        const u = await api('POST', '/uploads', { ...job.target, ...Object.fromEntries([...job.row.closest('[data-upload]').querySelectorAll('input[name],select[name]')].filter(el=>el.type!=='radio'||el.checked).map(el=>[el.name,el.value])), name: job.file.name, size: job.file.size, lastModified: job.file.lastModified })
        job.id = u.id; job.received = u.received; job.state = 'uploading'; draw(job); resumed(job)
        const have = new Set(u.parts), count = Math.ceil(job.file.size / u.partSize)
        for (let n = 1; n <= count; n++) {
          if (have.has(n)) continue
          if (job.state === 'paused' || job.state === 'cancelled') return
          const start = (n - 1) * u.partSize, part = job.file.slice(start, Math.min(job.file.size, start + u.partSize))
          job.state = 'uploading'; draw(job)
          const after = await put(job, n, part); job.received = after.received; attempt = 0; draw(job)
        }
        job.state = 'verifying'; draw(job)
        const done = await api('POST', `/uploads/${job.id}/complete`, {})
        const item = await api('GET', `/items/${done.result.item}`)
        job.result = done.result; job.checksum = (item.versions.find(v => v.id === done.result.version) || item.versions[0]).checksum
        job.state = 'done'; draw(job); return
      } catch (e) {
        if (job.state === 'paused' || job.state === 'cancelled') return
        if (e instanceof Refused) { job.state = 'failed'; job.problem.textContent = e.code === 'storage_limit_exceeded' && e.detail ? `${e.detail.scope === 'user' ? 'Personal area' : 'Space'} storage limit: ${e.detail.usedBytes} bytes used of ${e.detail.limitBytes} bytes. Ask a service settings admin to raise the limit or permanently erase retained files.` : problems[e.code] || `Chest refused this file (${e.code}).`; draw(job); return }
        job.state = 'retrying'; draw(job)
        await Promise.race([wait(Math.min(30000, 1000 * 2 ** attempt)), new Promise(r => addEventListener('online', r, { once: true }))])
        if (job.state !== 'retrying') return
      }
    }
  }
  function row(panel, file) {
    const li = document.createElement('li'); li.className = 'upload-item'
    li.innerHTML = '<div class="upload-line"><strong class="upload-name"></strong><span class="upload-status mono"></span></div><progress max="100" value="0"></progress><div class="upload-line"><span class="upload-bytes mono"></span><span class="upload-buttons"><button type="button" class="upload-button" data-pause>Pause</button><button type="button" class="upload-button" data-cancel>Cancel</button></span></div><p class="upload-problem" role="alert"></p>'
    li.querySelector('.upload-name').textContent = file.name
    panel.querySelector('[data-list]').append(li)
    return li
  }
  for (const panel of panels) {
    panel.hidden = false
    for (const fallback of document.querySelectorAll('[data-upload-fallback]')) fallback.hidden = true
    const target = { space: panel.dataset.space || undefined, parent: panel.dataset.parent || undefined, item: panel.dataset.item || undefined }
    const jobs = []
    let running = null
    async function drain() {
      if (running) return running
      running = (async () => {
        for (let job; (job = jobs.find(j => j.state === 'waiting')); ) await send(job)
        running = null
        const settled = jobs.filter(j => j.state !== 'cancelled')
        if (settled.length && settled.every(j => j.state === 'done')) {
          await wait(500)
          location.href = !target.item && settled.length === 1 ? `/app/items/${settled[0].result.item}` : location.pathname
        } else if (settled.some(j => j.state === 'done') && !jobs.some(j => ['waiting', 'starting', 'uploading', 'retrying', 'paused', 'verifying'].includes(j.state))) panel.querySelector('[data-refresh]').hidden = false
      })()
      return running
    }
    function add(files) {
      for (const file of files) {
        const li = row(panel, file), job = { file, target, state: 'waiting', received: 0, inflight: 0, row: li, bar: li.querySelector('progress'), status: li.querySelector('.upload-status'), bytes: li.querySelector('.upload-bytes'), pause: li.querySelector('[data-pause]'), cancel: li.querySelector('[data-cancel]'), problem: li.querySelector('.upload-problem') }
        job.pause.onclick = () => { if (job.state === 'paused') { job.state = 'waiting'; draw(job); drain() } else { job.state = 'paused'; job.xhr?.abort(); draw(job) } }
        job.cancel.onclick = async () => { const was = job.state; job.state = 'cancelled'; job.xhr?.abort(); draw(job); if (job.id && was !== 'waiting') await api('POST', `/uploads/${job.id}/cancel`, {}).catch(() => {}) }
        jobs.push(job); draw(job)
      }
      drain()
    }
    for (const input of panel.querySelectorAll('input[data-pick]')) input.addEventListener('change', () => { add([...input.files]); input.value = '' })
    // Desktop: files dropped anywhere on the page go to this folder.
    let depth = 0
    const over = on => panel.classList.toggle('upload-over', on)
    const carries = e => [...(e.dataTransfer?.types || [])].includes('Files')
    addEventListener('dragenter', e => { if (carries(e)) { depth++; over(true) } })
    addEventListener('dragleave', e => { if (carries(e) && --depth <= 0) { depth = 0; over(false) } })
    addEventListener('dragover', e => { if (carries(e)) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy' } })
    addEventListener('drop', e => { if (!carries(e)) return; e.preventDefault(); depth = 0; over(false); const files = [...e.dataTransfer.files].filter(f => f.size || f.type); if (files.length) add(panel.dataset.item ? files.slice(0, 1) : files) })
    panel.querySelector('[data-refresh]').onclick = () => location.reload()
  }
})()
