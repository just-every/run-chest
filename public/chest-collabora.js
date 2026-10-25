// Collabora performs its own save, close and reload handshake. Chest never discards the frame on a timer.
for (const host of document.querySelectorAll('[data-collabora]')) {
 const form = host.querySelector('form'), frame = host.querySelector('iframe'), status = host.querySelector('[data-collabora-status]');
 const origin = host.dataset.origin, token = form.elements.access_token.value;
 let loaded = false, started = false, stopped = false, checking = false, pending = false, notified = host.dataset.restore;
 const send = (MessageId, Values = {}) => frame.contentWindow.postMessage(JSON.stringify({MessageId, SendTime: Date.now(), Values}), origin);
 for (const button of host.querySelectorAll('[data-review-decision]')) button.addEventListener('click', () => {
  if (!loaded || stopped || pending) return;
  send('Send_UNO_Command', {Command: '.uno:NextTrackedChange'});
  send('Send_UNO_Command', {Command: button.dataset.reviewDecision === 'accept' ? '.uno:AcceptTrackedChange' : '.uno:RejectTrackedChange'});
  send('Action_Save', {DontTerminateEdit: true, DontSaveIfUnmodified: true, Notify: true});
  status.textContent = 'Collabora is saving the suggestion decision.';
 });
 form.addEventListener('submit', () => {
  started = true; loaded = false; frame.hidden = false; form.hidden = true;
  status.textContent = 'Opening Collabora Online…';
 });
 window.addEventListener('message', event => {
  if (stopped || event.origin !== origin || event.source !== frame.contentWindow) return;
  let message; try { message = typeof event.data === 'string' ? JSON.parse(event.data) : event.data; } catch { return; }
  if (message?.MessageId === 'Error' && /^[a-zA-Z0-9_-]{1,80}$/.test(message.Values?.Kind ?? '')) {
   status.textContent = 'The editor reported a refusal. Keep your work; the file preview remains available.';
   fetch(host.dataset.state, {method:'POST', headers:{authorization:'Bearer '+token,'content-type':'application/json'}, body:JSON.stringify({event:'provider-refused',kind:message.Values.Kind}), cache:'no-store'}).catch(()=>{status.textContent='The editor reported a refusal; its report could not be saved. Keep your work.';});
  }
  if (message?.MessageId === 'App_LoadingStatus') {
   if (message.Values?.Status === 'Frame_Ready') send('Host_PostmessageReady');
   if (message.Values?.Status === 'Document_Loaded') {
    loaded = true; pending = false;
    for (const button of host.querySelectorAll('[data-review-decision]')) button.disabled = false;
    status.textContent = 'Editor connected. Restores are checked automatically.';
    check();
   }
  }
  if (message?.MessageId === 'Action_Save_Resp') status.textContent = message.Values?.result === 'unmodified' ? 'No changes are waiting to be saved.' : message.Values?.success === false ? 'The save was refused. Keep your work and check your current access.' : 'Collabora saved the document.';
  if (message?.MessageId === 'App_VersionRestore' && message.Values?.Status === 'Pre_Restore_Ack' && pending) {
   // Collabora acknowledges only after its save and close; it reloads the current WOPI original itself.
   loaded = false; pending = false;
   status.textContent = 'Collabora is loading the restored version.';
  }
 });
 async function check() {
  if (!started || !loaded || stopped || checking || pending) return;
  checking = true;
  try {
   const response = await fetch(host.dataset.state, {headers: {authorization: 'Bearer ' + token}, cache: 'no-store'});
   if (!response.ok) {
    status.textContent = 'Cannot check restores. Your access may have ended; keep any unsaved work in the editor.';
    return;
   }
   const state = await response.json();
   if (stopped) return;
   if (state.restore !== notified) {
    notified = state.restore; pending = true;
    status.textContent = 'A version was restored. Collabora is reconciling the change. If it reports unsaved work, keep that work before reopening the editor.';
    send('Host_VersionRestore', {Status: 'Pre_Restore'});
   }
  } catch { status.textContent = 'Restore checks are offline. Keep any unsaved work in the editor.'; }
  finally { checking = false; }
 }
 const timer = setInterval(check, 12000);
 document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check(); });
 window.addEventListener('pagehide', () => { stopped = true; clearInterval(timer); fetch(host.dataset.state, {method:'POST', headers:{authorization:'Bearer '+token}, keepalive:true, cache:'no-store'}).catch(()=>{}); });
}
