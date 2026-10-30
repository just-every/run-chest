// "Copy link": puts the link beside it on the clipboard and says so on the button for a moment.
(() => {
  for (const button of document.querySelectorAll('[data-copy]')) {
    const box = button.parentElement.querySelector('input'), label = button.textContent
    button.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(box.value) } catch { box.select(); document.execCommand('copy') }
      button.textContent = 'Copied'; setTimeout(() => { button.textContent = label }, 2000)
    })
  }
})()
