// Run only in run-demo, after deploying the test host and before a start cohort.
// Keep a continuous quiet window so unrelated visitors cannot occupy its places.
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';

const account = process.env.CLOUDFLARE_ACCOUNT_ID;
if (account !== 'b20c0ca9cab0c2b70e13d7cf724b89bd') throw Error('Wrong demo account');
const worker = JSON.parse(readFileSync('.rer/demo-host/wrangler.json', 'utf8')).name;
const endpoint = `https://api.cloudflare.com/client/v4/accounts/${account}/workers/scripts/${worker}/tails`;
const headers = { authorization: `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`, 'content-type': 'application/json' };
const response = await fetch(endpoint, { method: 'POST', headers, body: '{}' });
const created = await response.json();
if (!response.ok || !created.success) throw Error(`Demo tail creation failed (${response.status})`);
const tail = created.result, socket = new WebSocket(tail.url, 'trace-v1');
socket.binaryType = 'arraybuffer';
const output = process.env.RUNNER_TEMP + '/demo-admissions.jsonl';
const startedAt = Date.now(), quietMs = 15 * 60_000;
writeFileSync(output, JSON.stringify({ event: 'observing', worker, at: new Date(startedAt).toISOString() }) + '\n');
let lastAdmission = startedAt, admissions = 0, finished = false, timer;
try {
  await new Promise((resolve, reject) => {
    socket.addEventListener('error', () => reject(Error('Demo tail connection failed')));
    socket.addEventListener('close', () => { if (!finished) reject(Error('Demo tail closed before the quiet window completed')); });
    socket.addEventListener('open', () => {
      timer = setInterval(() => {
        if (Date.now() - lastAdmission >= quietMs) { finished = true; resolve(); }
        else if (Date.now() - startedAt > 18 * 60_000) reject(Error('Test host has unrelated visitors; wait for a quiet window'));
      }, 1000);
      console.log('Observing test host for a continuous 15-minute quiet window');
    });
    socket.addEventListener('message', message => {
      try {
        const event = JSON.parse(typeof message.data === 'string' ? message.data : new TextDecoder().decode(message.data));
        for (const log of event.logs ?? []) for (const part of log.message ?? []) {
          const text = typeof part === 'string' ? part : JSON.stringify(part);
          if (!text.includes('demo_admitted')) continue;
          lastAdmission = Date.now(); admissions++;
          appendFileSync(output, JSON.stringify({ event: 'demo_admitted', at: new Date(lastAdmission).toISOString(), detail: text }) + '\n');
        }
      } catch { reject(Error('Demo tail returned an unreadable event')); }
    });
  });
  const summary = { event: 'quiet', at: new Date().toISOString(), quietSince: new Date(lastAdmission).toISOString(), admissions, quietMs };
  appendFileSync(output, JSON.stringify(summary) + '\n');
  console.log(JSON.stringify(summary));
} finally {
  finished = true; clearInterval(timer); socket.close();
  const removed = await fetch(endpoint + '/' + tail.id, { method: 'DELETE', headers });
  if (!removed.ok) throw Error(`Demo tail cleanup failed (${removed.status})`);
}
