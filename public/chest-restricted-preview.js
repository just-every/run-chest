for (const root of document.querySelectorAll('[data-restricted-preview]')) {
 const image = root.querySelector('[data-preview-page]'), status = root.querySelector('[data-preview-status]')
 const previous = root.querySelector('[data-previous]'), next = root.querySelector('[data-next]'), count = root.querySelector('[data-page-count]')
 const total = Number(root.dataset.pages); let page = 1
 const refuse = event => { event.preventDefault(); status.textContent = 'Downloading, printing and copying are turned off.' }
 for (const event of ['copy', 'cut', 'contextmenu', 'dragstart']) document.addEventListener(event, refuse, true)
 document.addEventListener('keydown', event => { if ((event.ctrlKey || event.metaKey) && ['p', 'c', 'x', 'a', 's'].includes(event.key.toLowerCase())) refuse(event) }, true)
 window.addEventListener('beforeprint', () => { status.textContent = 'Printing is turned off for this preview.' })
 const show = nextPage => {
  page = nextPage; image.hidden = true
  status.textContent = 'Loading page…'; count.textContent = `Page ${page} of ${total}`
  previous.disabled = page === 1; next.disabled = page === total
  image.alt = `Rendered page ${page}`; image.src = root.dataset.pageUrl + page
 }
 image.addEventListener('load', () => { image.hidden = false; status.textContent = 'Downloading, printing and copying are turned off.' })
 image.addEventListener('error', () => { image.hidden = true; status.textContent = 'Preview unavailable. Reopen the file to check your current access.' })
 previous.addEventListener('click', () => { if (page > 1) show(page - 1) })
 next.addEventListener('click', () => { if (page < total) show(page + 1) })
}
