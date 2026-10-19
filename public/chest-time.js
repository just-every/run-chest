// Times in Chest are kept in UTC. In the browser every time is shown on the person's own clock in one US form, 12-hour
// with no leading zero ("Oct 19, 2026, 6:35 AM"). Full stamps name the zone after it ("… 6:35 AM PDT"); the compact form in
// tables, panels and cards names it in the tooltip. Zone pickers (restore to a date, search dates) start on that zone.
(() => {
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone
  for (const s of document.querySelectorAll('select[data-zone]')) if ([...s.options].some(o => o.value === zone)) s.value = zone
  for (const i of document.querySelectorAll('input[data-zone]')) i.value = zone
  const show = new Intl.DateTimeFormat('en-US', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' })
  const short = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
  for (const t of document.querySelectorAll('time[data-local]')) { const at = new Date(t.getAttribute('datetime')); if (isNaN(at)) continue; if (t.dataset.local === 'short') { t.title = show.format(at); t.textContent = short.format(at) } else { t.title = t.textContent; t.textContent = show.format(at) } }
})()
