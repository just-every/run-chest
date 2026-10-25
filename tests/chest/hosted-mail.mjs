import PostalMime from 'postal-mime';
import { setTimeout as delay } from 'node:timers/promises';

const inbox = 'https://rer-qa-inbox.runeditrun.workers.dev';
const pollMs = 4000;
const timeoutMs = 90_000;
class MailProofError extends Error {}
const fail = message => { throw new MailProofError(message); };

function hostedOrigin(value) {
 let url;
 try { url = new URL(value); } catch { fail('Hosted mail proof requires a valid origin'); }
 if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
  fail('Hosted mail proof requires an HTTPS origin without credentials, path or query');
 }
 return url.origin;
}

function mailbox(value) {
 if (typeof value !== 'string') fail('Hosted mail proof requires recipient and sender addresses');
 const address = (value.match(/<([^<>]+)>\s*$/)?.[1] ?? value).trim().toLowerCase();
 if (!/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(address)) fail('Hosted mail proof requires valid mail addresses');
 return address;
}

function sinceTime(value) {
 const time = typeof value === 'number' ? value : value instanceof Date ? value.getTime()
  : typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : Date.parse(value);
 if (!Number.isFinite(time) || time <= 0 || !Number.isFinite(new Date(time).getTime())) fail('Hosted mail proof requires an explicit valid since time');
 return time;
}

async function inboxFetch(url, token, deadline) {
 const remaining = deadline - Date.now();
 if (remaining <= 0) fail('Hosted mail delivery was not proven within 90 seconds');
 let response;
 try {
  response = await fetch(url, {
   headers: { Authorization: `Bearer ${token}` }, redirect: 'error',
   signal: AbortSignal.timeout(Math.min(10_000, remaining)),
  });
 } catch { fail('QA inbox request failed; private request details withheld'); }
 if (!response.ok) fail(`QA inbox refused the request (HTTP ${response.status}); response body withheld`);
 return response;
}

function unescapeHref(value) {
 return value.replace(/&(?:amp|quot|apos|lt|gt|#\d+|#x[\da-f]+);/gi, entity => {
  const named = { '&amp;': '&', '&quot;': '"', '&apos;': "'", '&lt;': '<', '&gt;': '>' };
  if (named[entity.toLowerCase()]) return named[entity.toLowerCase()];
  const hexadecimal = /^&#x/i.test(entity);
  const code = parseInt(entity.slice(hexadecimal ? 3 : 2, -1), hexadecimal ? 16 : 10);
  return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : '';
 });
}

function confirmationLink(message, origin) {
 const hrefs = [...(message.html ?? '').matchAll(/<a\b[^>]*\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi)]
  .map(match => unescapeHref(match[1] ?? match[2] ?? match[3]));
 const textUrls = (message.text ?? '').match(/https:\/\/[^\s<>"']+/g) ?? [];
 const matches = new Set();
 for (const value of [...hrefs, ...textUrls]) {
  let url;
  try { url = new URL(value); } catch { continue; }
  if (url.origin !== origin || url.pathname !== '/auth/confirm' || url.username || url.password || url.hash) continue;
  if (url.searchParams.getAll('token').length !== 1 || !url.searchParams.get('token')) continue;
  if ([...url.searchParams.keys()].some(key => key !== 'token')) continue;
  matches.add(url.href);
 }
 if (matches.size > 1) fail('Delivered mail contained several confirmation links at the expected origin');
 return [...matches][0] ?? null;
}

/** Poll real delivered mail. Subject is exact; since must precede the triggering action.
 * Both sign-in and invitation messages use /auth/confirm. Never log the returned URL.
 * Receipt auth is receiver evidence, returned for the caller to assert its mail policy.
 */
export async function waitForMailLink({ to, subject, since, origin, from, token = process.env.QA_INBOX_RECEIPT_TOKEN }) {
 const expectedOrigin = hostedOrigin(origin), recipient = mailbox(to), sender = mailbox(from);
 const sinceMs = sinceTime(since);
 if (typeof subject !== 'string' || !subject.trim()) fail('Hosted mail proof requires an exact expected subject');
 if (typeof token !== 'string' || !token.trim()) fail('QA_INBOX_RECEIPT_TOKEN is required for the live inbox proof');
 const endpoint = new URL('/receipts', inbox);
 for (const [key, value] of Object.entries({ to: recipient, from: sender, subject, since: new Date(sinceMs).toISOString(), limit: '50' })) {
  endpoint.searchParams.set(key, value);
 }
 const deadline = Date.now() + timeoutMs, inspected = new Set();
 while (Date.now() < deadline) {
  let body;
  const response = await inboxFetch(endpoint, token, deadline);
  try { body = await response.json(); } catch { fail('QA inbox returned an unreadable receipt response; contents withheld'); }
  if (body?.ok !== true || !Array.isArray(body.receipts)) fail('QA inbox returned an invalid receipt response; contents withheld');
  const candidates = body.receipts.filter(receipt => {
   if (!receipt || typeof receipt.receivedAt !== 'string' || !Number.isFinite(Date.parse(receipt.receivedAt))) return false;
   if (inspected.has(receipt.id) || Date.parse(receipt.receivedAt) < sinceMs || receipt.subject !== subject) return false;
   try { return mailbox(receipt.to) === recipient && mailbox(receipt.from) === sender; } catch { return false; }
  }).sort((a, b) => Date.parse(b.receivedAt) - Date.parse(a.receivedAt));
  for (const receipt of candidates) {
   if (typeof receipt.id !== 'string' || !/^[\w-]+$/.test(receipt.id)) fail('QA inbox returned an invalid receipt identity');
   // Restrict rawUrl before sending the bearer token; redirects are forbidden too.
   if (receipt.rawUrl !== `/receipts/${receipt.id}/raw`) fail('Delivered mail has no safe raw MIME receipt');
   const raw = await inboxFetch(new URL(receipt.rawUrl, inbox), token, deadline);
   let message;
   try { message = await PostalMime.parse(await raw.arrayBuffer()); }
   catch { fail('Delivered mail MIME could not be parsed; contents withheld'); }
   if (message.subject !== subject || mailbox(message.from?.address) !== sender) fail('Delivered MIME did not match the requested subject and sender');
   const url = confirmationLink(message, expectedOrigin);
   inspected.add(receipt.id);
   // Other live Chest proofs share the QA inbox. Only this deployment's link proves this request.
   if (!url) continue;
   return { url, receipt: { id: receipt.id, receivedAt: receipt.receivedAt, subject: receipt.subject, auth: receipt.auth } };
  }
  await delay(Math.min(pollMs, Math.max(0, deadline - Date.now())));
 }
 fail('Hosted mail delivery was not proven within 90 seconds');
}

/** Fresh browser identity through the ordinary sign-in and confirmation forms.
 * Caller owns and must close the returned context. Failures close it here.
 * Do not enable traces, HAR or request logging around credential navigation.
 */
export async function emailSignIn({ browser, origin, email, from, width = 1440 }) {
 const expectedOrigin = hostedOrigin(origin), recipient = mailbox(email);
 mailbox(from);
 let context, stage = 'creating a fresh browser context';
 try {
  context = await browser.newContext({ viewport: { width, height: width <= 760 ? 844 : 1000 } });
  const page = await context.newPage();
  stage = 'opening the sign-in page';
  const response = await page.goto(`${expectedOrigin}/signin`);
  if (!response?.ok()) fail('Hosted sign-in page was unavailable');
  for (const screenWidth of [1440, 390]) {
   await page.setViewportSize({ width: screenWidth, height: screenWidth === 390 ? 844 : 1000 });
   if (!await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)) fail('Hosted sign-in overflows its viewport');
   await page.screenshot({ path: `test-results/${screenWidth}-hosted-signin.png`, fullPage: true });
  }
  await page.setViewportSize({ width, height: width <= 760 ? 844 : 1000 });
  await page.getByRole('textbox', { name: 'Email', exact: true }).fill(recipient);
  const since = Date.now();
  stage = 'requesting a sign-in email';
  await page.getByRole('button', { name: 'Email a sign-in link', exact: true }).click();
  await page.waitForURL(url => url.origin === expectedOrigin && url.pathname === '/signin' && url.searchParams.get('notice') === 'sent');
  stage = 'waiting for delivered sign-in mail';
  const { url, receipt } = await waitForMailLink({ to: recipient, subject: 'Your sign-in link for Chest', since, origin: expectedOrigin, from });
  stage = 'opening the email confirmation page';
  const confirmation = await page.goto(url);
  if (!confirmation?.ok()) fail('Delivered sign-in link was refused by the confirmation page');
  await page.getByRole('heading', { name: 'Confirm sign-in to Chest', exact: true }).waitFor();
  stage = 'confirming sign-in';
  await page.getByRole('button', { name: 'Confirm', exact: true }).click();
  await page.waitForURL(location => location.origin === expectedOrigin && ['/setup', '/app/files'].includes(location.pathname));
  if (new URL(page.url()).pathname === '/setup') {
   stage = 'finishing owner setup';
   await page.getByRole('checkbox', { name: 'I confirm this owner account is ready to use.', exact: true }).check();
   await page.getByRole('button', { name: 'Finish setup', exact: true }).click();
   await page.waitForURL(location => location.origin === expectedOrigin && location.pathname === '/app/files');
  }
  stage = 'checking the signed-in identity';
  const sessionResponse = await page.request.get(`${expectedOrigin}/auth/session`);
  if (!sessionResponse.ok()) fail('Email confirmation did not establish a current session');
  const session = await sessionResponse.json();
  if (session?.operator?.email?.toLowerCase() !== recipient || session.kind !== 'native') fail('Email confirmation did not establish the requested ordinary identity');
  await page.getByRole('heading', { name: 'Files', exact: true }).waitFor();
  return { context, page, receipt };
 } catch (error) {
  await context?.close().catch(() => {});
  if (error instanceof MailProofError) throw error;
  fail(`Hosted email sign-in failed while ${stage}; private browser details withheld`);
 }
}
