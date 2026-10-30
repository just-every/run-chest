// Times in Chest are kept in UTC. In the browser every time is shown on the person's own clock in one short US form,
// 12-hour with no leading zero ("Oct 19, 2026, 6:35 AM"), the same in lists, panels and cards; the tooltip names the
// zone. Zone pickers (restore to a date, search dates) start on the browser's zone, added to the list when it is not there.
(() => {
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone
  for (const s of document.querySelectorAll('select[data-zone]')) {
    if (![...s.options].some(o => o.value === zone)) {
      const o = document.createElement('option'), abbr = new Intl.DateTimeFormat('en-US', { timeZone: zone, timeZoneName: 'short' }).formatToParts().find(p => p.type === 'timeZoneName')?.value
      o.value = zone; o.textContent = `${zone.split('/').pop().replace(/_/g, ' ')}${abbr ? ` (${abbr})` : ''}`; s.prepend(o)
    }
    s.value = zone
  }
  for (const i of document.querySelectorAll('input[data-zone]')) i.value = zone
  const show = new Intl.DateTimeFormat('en-US', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' })
  const short = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
  for (const t of document.querySelectorAll('time[data-local]')) { const at = new Date(t.getAttribute('datetime')); if (isNaN(at)) continue; t.title = show.format(at); t.textContent = short.format(at) }
  for (const o of document.querySelectorAll('option[data-at]')) { const at = new Date(o.dataset.at); if (!isNaN(at)) o.textContent = (o.dataset.prefix ?? '') + short.format(at) }
})()
