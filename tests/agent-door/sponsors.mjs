// Disposable native admission only. No signer, writable database or production route.
let reviewers;
const identities = new Map();
const responses = new Map();
export function configureReviewers(value) { reviewers = value; }
export async function initializeReviewer({ request, origin, label, email, owner, mail }) {
  const invited = await request(new URL('/api/chest/people', origin).href, {
    method: 'POST', headers: {Cookie: owner.cookie, Origin: origin, 'Content-Type': 'application/json'},
    body: JSON.stringify({action: 'resend-invite', email}),
  });
  if (!invited.ok) throw Error('Native sponsor invitation failed');
  await invited.body.cancel();
  const messages = await mail.read();
  const link = messages.findLast(message => message.text?.includes('/auth/confirm?'))?.text.match(/https?:\/\/[^\s<>]+\/auth\/confirm\?[^\s<>]+/)?.[0];
  if (!link) throw Error('Native sponsor invitation unavailable');
  const confirmed = await request(new URL('/auth/confirm', origin).href, {
    method: 'POST', headers: {Origin: origin, 'Content-Type': 'application/x-www-form-urlencoded'},
    body: new URLSearchParams({token: new URL(link).searchParams.get('token'), returnTo: '/app/files'}),
  });
  if (confirmed.status !== 303) throw Error('Native sponsor confirmation failed');
  responses.set(label, confirmed);
  return confirmed;
}
export default async function ({label, email, sub, owner}) {
  if (!reviewers) throw Error('Native sponsor reviewer lifecycle unavailable');
  await reviewers.initialize(label, {cookie: owner.cookie});
  identities.set(label, {sub, email});
  return responses.get(label);
}
export async function prepare({phase, request, origin, cookie}) {
  const post = async (path, body) => {
    const response = await request(new URL(path, origin).href, {method:'POST', headers:{Cookie:cookie,Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(body)});
    if (!response.ok) throw Error('Native sponsor state change failed');
    await response.body.cancel();
  };
  // Restore the ordinary native domain policy before later rounds.
  if (phase !== 'negative') {
    if (identities.has('excluded')) await post('/api/chest/organisation/domains', {allowedDomains:[],requiredDomains:[]});
    return {};
  }
  await post('/api/chest/people', {action:'deactivate',email:identities.get('inactive').email});
  await post('/api/chest/organisation/domains', {allowedDomains:['example.com'],requiredDomains:[]});
  return {sponsors:Object.fromEntries(identities)};
}
