// A manager configures restricted email intake through the browser and reconciles the saved scope.
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { chromium } from '@playwright/test'
import { harness } from './harness.mjs'

const h = await harness(), mail = name => name + '@' + 'example.test'
const bytes = Buffer.from('Synthetic Chest intake attachment. Retain these exact bytes.')
const hash = value => createHash('sha256').update(value).digest('hex')
const press = (page, button) => Promise.all([page.waitForNavigation(), button.click()])
let browser
try {
 await mkdir('test-results', { recursive: true })
 await h.raw('/auth/bootstrap', null, { token: h.vars.SETUP_TOKEN, displayName: 'Alex Morgan' })
 const owner = await h.signIn(h.vars.OWNER_EMAIL)
 await h.fetch('/setup', { method:'POST', headers:{ cookie:owner, origin:h.origin, 'content-type':'application/x-www-form-urlencoded' }, body:'confirm=yes' })
 const space = await h.api('/spaces', owner, { name:'Supplier records' })
 const folder = await h.api('/items', owner, { space:space.id, type:'folder', name:'Email arrivals' })
 browser = await chromium.launch({ headless:true, executablePath:existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined, args:['--no-sandbox','--use-mock-keychain','--password-store=basic'] })
 const context = await browser.newContext({ viewport:{ width:1440, height:960 }, ignoreHTTPSErrors:true })
 await context.addCookies(owner.split('; ').map(s => { const i=s.indexOf('='); return { name:s.slice(0,i), value:s.slice(i+1), url:h.origin } }))
 const page = await context.newPage()
 await page.goto(h.origin + '/app/filing/intake')
 const configure = page.locator('section.card').filter({ has:page.getByRole('heading', { name:'1. Choose an address and folder', exact:true }) })
 await configure.getByLabel('Space').selectOption(space.id)
 await configure.getByLabel('Inbox folder').selectOption(folder.id)
 await configure.getByLabel('Intake email address').fill(mail('arrivals'))
 await configure.getByLabel('Sender restriction').selectOption('exact')
 await configure.getByLabel('Allowed sender (exact)', { exact:true }).fill(mail('supplier').toUpperCase())
 await press(page, configure.getByRole('button', { name:'Save intake', exact:true }))
 const addresses = page.locator('section.card').filter({ has:page.getByRole('heading', { name:'Addresses', exact:true }) })
 const saved = async enabled => {
  const configs = (await h.api('/filing/intake', owner)).intakes
  assert.equal(configs.length, 1)
  assert.equal(configs[0].payload.senderScope, 'exact')
  assert.equal(configs[0].payload.allowedSender, mail('supplier'))
  assert.equal(configs[0].payload.enabled, enabled)
  assert.ok((await addresses.innerText()).includes('Only envelope sender: ' + mail('supplier')))
  return configs[0]
 }
 await saved(true)
 await press(page, addresses.getByRole('button', { name:'Pause intake', exact:true }))
 await saved(false)
 await h.stop(); await h.start(); await page.reload()
 await saved(false)
 await press(page, addresses.getByRole('button', { name:'Enable intake', exact:true }))
 await saved(true)
 const message = ['From: '+mail('header-only'),'To: '+mail('arrivals'),'Message-ID: <'+mail('browser-intake')+'>','Subject: Supplier original','MIME-Version: 1.0','Content-Type: multipart/mixed; boundary="intake-proof"','','--intake-proof','Content-Type: text/plain','Content-Disposition: attachment; filename="Supplier original.txt"','Content-Transfer-Encoding: base64','',bytes.toString('base64'),'--intake-proof--',''].join('\r\n')
 assert.ok(!(await h.email(mail('supplier'), mail('arrivals'), message)).rejectReason, 'a different MIME header does not override the permitted envelope')
 await h.email(mail('supplier'), mail('arrivals'), message)
 await h.stop(); await h.start(); await page.reload()
 await saved(true)
 const receipts = (await h.api('/filing/intake', owner)).receipts
 assert.equal(receipts.length, 1)
 assert.equal(receipts[0].payload.envelopeFrom, mail('supplier'))
 assert.equal(receipts[0].payload.sender, mail('header-only'))
 const attachment = page.getByRole('link', { name:'Supplier original.txt', exact:true })
 assert.equal(await attachment.count(), 1)
 const file = await h.api('/items/' + receipts[0].payload.item, owner)
 const original = await h.raw('/api/chest/items/' + file.id + '/bytes/' + file.item.current + '?download=true', owner)
 assert.equal(original.status, 200)
 assert.equal(hash(Buffer.from(await original.arrayBuffer())), hash(bytes))
 await addresses.getByText('Change sender restriction', { exact:true }).click()
 assert.equal(await addresses.getByLabel('Sender restriction').inputValue(), 'exact')
 assert.equal(await addresses.getByLabel('Allowed sender (exact)', { exact:true }).inputValue(), mail('supplier'))
 // The touched screen uses the existing icon labels and shared keyboard tooltip.
 const icons = page.locator('button:visible, a:visible').filter({ has:page.locator('svg') })
 for (const control of await icons.all()) {
  const onlyIcon = await control.evaluate(el => { const copy=el.cloneNode(true); copy.querySelectorAll('svg,.sr-only').forEach(n=>n.remove()); return !copy.textContent.trim() })
  if (onlyIcon) assert.ok(await control.getAttribute('data-tooltip'), 'icon control has a tooltip')
 }
 const signout = page.getByRole('button', { name:'Sign out', exact:true })
 await signout.focus()
 assert.equal(await page.getByRole('tooltip').innerText(), 'Sign out')
 await page.keyboard.press('Escape')
 await configure.getByLabel('Intake email address').focus()
 const scopeFont = await addresses.getByLabel('Allowed sender (exact)').evaluate(el => parseFloat(getComputedStyle(el).fontSize))
 assert.ok(scopeFont >= 13, 'sender field font: '+scopeFont)
 await page.evaluate(async () => { await document.fonts.ready; window.scrollTo(0,0) })
 await page.screenshot({ path:'test-results/1440-intake.png', fullPage:true })
 await page.setViewportSize({ width:390, height:960 })
 await page.evaluate(() => window.scrollTo(0,0))
 await page.screenshot({ path:'test-results/390-intake.png', fullPage:true })
 console.log('PROBE CONNECT-006 2-browser: public intake form -> exact sender displayed and persisted through pause, enable and Worker restart; original hash and one receipt reconciled')
 console.log('Email intake sender configuration browser journey passed at 1440; screen proof saved at 1440 and 390')
 await context.close()
} finally {
 await browser?.close()
 await h.close()
}
