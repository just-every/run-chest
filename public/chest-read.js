// Reading progress: while Chest is still reading a file or a scan, its section polls the reading status (each poll
// also lets the server read the next page) and shows how far it has got; when nothing is left it reloads the page
// once to show the text and any values read. Without this script the page shows the state as of loading.
(() => {
  const boxes = [...document.querySelectorAll('[data-reading-poll]')]
  if (!boxes.length || !window.fetch) return
  const busy = s => ['queued', 'reading', 'waiting'].includes(s)
  const line = r => r.state === 'queued' ? 'Waiting to be read.' : `Reading: ${r.pages.filter(p => p.state !== 'waiting').length} of ${r.pages.length} page${r.pages.length === 1 ? '' : 's'} done.`
  const started = Date.now()
  for (const url of new Set(boxes.map(b => b.dataset.readingPoll))) {
    const mine = boxes.filter(b => b.dataset.readingPoll === url)
    const tick = async () => {
      if (Date.now() - started > 15 * 60_000) return
      let data
      try { const r = await fetch(`${url}?work=1`, { credentials: 'same-origin' }); if (!r.ok) throw new Error(String(r.status)); data = await r.json() } catch { setTimeout(tick, 8000); return }
      const readings = data.reading ? [data.reading] : (data.versions || []).map(v => v.reading).filter(Boolean)
      const fields = (data.versions || []).map(v => v.fields).filter(Boolean)
      const pending = readings.find(r => busy(r.state))
      if (pending || fields.some(f => busy(f.state))) {
        for (const b of mine) { const l = b.querySelector('[data-reading-line]') || (b.matches('[data-reading-line]') ? b : null); if (l && pending) l.textContent = (l.textContent.startsWith('Text: ') ? 'Text: ' : '') + line(pending); else if (l && !pending) l.textContent = 'Reading fields from this scan…' }
        setTimeout(tick, 2500)
      } else location.reload()
    }
    setTimeout(tick, 1500)
  }
})()
