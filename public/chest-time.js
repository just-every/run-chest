// Times in Chest are kept in UTC. In the browser they are shown on the person's own clock with its zone named (the
// compact form in tables and the details panel names it in the tooltip), and the restore-to-a-date form starts on that zone.
(() => {
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone
  for (const s of document.querySelectorAll('select[data-zone]')) if ([...s.options].some(o => o.value === zone)) s.value = zone
  for (const i of document.querySelectorAll('input[data-zone]')) i.value = zone
  const show = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZoneName: 'short' })
  const short = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
  for (const t of document.querySelectorAll('time[data-local]')) { const at = new Date(t.getAttribute('datetime')); if (isNaN(at)) continue; if (t.dataset.local === 'short') { t.title = show.format(at); t.textContent = short.format(at) } else { t.title = t.textContent; t.textContent = show.format(at) } }
})()
